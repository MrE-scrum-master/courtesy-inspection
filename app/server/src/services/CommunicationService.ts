import { Pool } from 'pg';
import { CommunicationRepository, Communication, CreateCommunicationData, CustomerPreference } from '../repositories/CommunicationRepository';
import { Logger } from '../utils/Logger';

export interface LogCommunicationOptions {
  shopId: number;
  customerId?: number;
  inspectionId?: number;
  userId?: number;
  type: 'sms' | 'email' | 'phone' | 'in_person';
  direction: 'outbound' | 'inbound';
  subject?: string;
  content: string;
  status?: 'sent' | 'delivered' | 'failed' | 'read';
  metadata?: any;
}

export interface ScheduleFollowUpOptions {
  customerId: number;
  shopId: number;
  userId: number;
  date: Date;
  message: string;
  type: 'sms' | 'email';
  metadata?: any;
}

export interface EngagementMetrics {
  customer_id: number;
  total_communications: number;
  response_count: number;
  response_rate: number;
  last_communication: Date | null;
  last_response: Date | null;
  avg_response_time_minutes: number;
  preferred_channel: string;
  engagement_score: number; // 0-100
}

export interface CommunicationTemplate {
  key: string;
  type: 'sms' | 'email';
  subject?: string;
  content: string;
  variables: string[];
}

export class CommunicationService {
  private readonly communicationRepository: CommunicationRepository;
  private readonly logger: Logger;

  // Default communication templates
  private readonly templates: CommunicationTemplate[] = [
    {
      key: 'inspection_ready',
      type: 'sms',
      content: 'Hi {{customer_name}}, your {{vehicle}} inspection is complete. View results: {{link}}',
      variables: ['customer_name', 'vehicle', 'link'],
    },
    {
      key: 'appointment_reminder',
      type: 'sms',
      content: 'Reminder: Your inspection appointment is tomorrow at {{time}}. Questions? Call {{shop_phone}}',
      variables: ['time', 'shop_phone'],
    },
    {
      key: 'follow_up_satisfaction',
      type: 'sms',
      content: 'Hi {{customer_name}}, how was your experience with our inspection service? Reply with your feedback!',
      variables: ['customer_name'],
    },
    {
      key: 'urgent_safety_issue',
      type: 'sms',
      content: 'URGENT: Safety issue found during inspection. Please call us immediately at {{shop_phone}}.',
      variables: ['shop_phone'],
    },
    {
      key: 'thank_you_message',
      type: 'sms',
      content: 'Thank you for choosing {{shop_name}}! Your {{vehicle}} inspection is complete. Drive safely!',
      variables: ['shop_name', 'vehicle'],
    },
  ];

  constructor(pool: Pool) {
    this.communicationRepository = new CommunicationRepository(pool);
    this.logger = new Logger('CommunicationService');
  }

  /**
   * Log a communication record
   */
  async logCommunication(options: LogCommunicationOptions): Promise<Communication> {
    const communicationData: CreateCommunicationData = {
      shop_id: options.shopId,
      customer_id: options.customerId,
      inspection_id: options.inspectionId,
      user_id: options.userId,
      communication_type: options.type,
      direction: options.direction,
      subject: options.subject,
      content: options.content,
      status: options.status || 'sent',
      metadata: {
        ...options.metadata,
        logged_at: new Date().toISOString(),
      },
    };

    const communication = await this.communicationRepository.createCommunication(communicationData);

    this.logger.info('Communication logged', {
      id: communication.id,
      type: options.type,
      direction: options.direction,
      customerId: options.customerId,
      inspectionId: options.inspectionId,
    });

    return communication;
  }

  /**
   * Get customer communication history
   */
  async getCustomerHistory(customerId: number, inspectionId?: number): Promise<Communication[]> {
    return this.communicationRepository.getCommunicationHistory(customerId, inspectionId);
  }

  /**
   * Schedule follow-up communication
   */
  async scheduleFollowUp(options: ScheduleFollowUpOptions): Promise<Communication> {
    const communicationData: CreateCommunicationData = {
      shop_id: options.shopId,
      customer_id: options.customerId,
      user_id: options.userId,
      communication_type: options.type,
      direction: 'outbound',
      content: options.message,
      scheduled_at: options.date,
      status: 'sent', // Will be processed later
      metadata: {
        ...options.metadata,
        scheduled: true,
        follow_up: true,
      },
    };

    const communication = await this.communicationRepository.scheduleCommunication(communicationData);

    this.logger.info('Follow-up scheduled', {
      id: communication.id,
      customerId: options.customerId,
      scheduledFor: options.date,
      type: options.type,
    });

    return communication;
  }

  /**
   * Track customer engagement
   */
  async trackEngagement(customerId: number, action: string, timestamp?: Date): Promise<void> {
    await this.logCommunication({
      shopId: 0, // Will be updated with actual shop ID
      customerId,
      type: 'in_person', // Generic engagement tracking
      direction: 'inbound',
      content: `Customer engagement: ${action}`,
      metadata: {
        engagement_action: action,
        tracked_at: timestamp || new Date(),
      },
    });

    this.logger.debug('Customer engagement tracked', {
      customerId,
      action,
      timestamp: timestamp || new Date(),
    });
  }

  /**
   * Calculate response rate for a shop
   */
  async calculateResponseRate(shopId: number, period: { start: Date; end: Date }): Promise<number> {
    const stats = await this.communicationRepository.getCommunicationStats(
      shopId,
      period.start,
      period.end
    );

    return stats.response_rate;
  }

  /**
   * Get customer engagement metrics
   */
  async getCustomerEngagement(customerId: number): Promise<EngagementMetrics> {
    const communications = await this.communicationRepository.getCustomerCommunications(customerId, 100);
    
    if (communications.length === 0) {
      return {
        customer_id: customerId,
        total_communications: 0,
        response_count: 0,
        response_rate: 0,
        last_communication: null,
        last_response: null,
        avg_response_time_minutes: 0,
        preferred_channel: 'sms',
        engagement_score: 0,
      };
    }

    const totalCommunications = communications.length;
    const responses = communications.filter(c => c.direction === 'inbound');
    const responseCount = responses.length;
    const responseRate = totalCommunications > 0 ? (responseCount / totalCommunications) * 100 : 0;

    const lastCommunication = communications[0]?.sent_at || null;
    const lastResponse = responses[0]?.sent_at || null;

    // Calculate average response time
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (let i = 1; i < communications.length; i++) {
      const current = communications[i];
      const previous = communications[i - 1];

      if (current.direction === 'inbound' && previous.direction === 'outbound') {
        const responseTime = current.sent_at.getTime() - previous.sent_at.getTime();
        totalResponseTime += responseTime / (1000 * 60); // Convert to minutes
        responseTimeCount++;
      }
    }

    const avgResponseTimeMinutes = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

    // Determine preferred channel
    const channelCounts = communications.reduce((acc, comm) => {
      acc[comm.communication_type] = (acc[comm.communication_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const preferredChannel = Object.entries(channelCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'sms';

    // Calculate engagement score (0-100)
    let engagementScore = 0;
    
    // Response rate component (40% of score)
    engagementScore += (responseRate / 100) * 40;
    
    // Frequency component (30% of score) - more communications = higher engagement
    const frequencyScore = Math.min(totalCommunications / 10, 1) * 30;
    engagementScore += frequencyScore;
    
    // Recency component (30% of score) - recent activity = higher engagement
    if (lastCommunication) {
      const daysSinceLastComm = (Date.now() - lastCommunication.getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, (30 - daysSinceLastComm) / 30) * 30;
      engagementScore += recencyScore;
    }

    return {
      customer_id: customerId,
      total_communications: totalCommunications,
      response_count: responseCount,
      response_rate: Math.round(responseRate * 100) / 100,
      last_communication: lastCommunication,
      last_response: lastResponse,
      avg_response_time_minutes: Math.round(avgResponseTimeMinutes),
      preferred_channel: preferredChannel,
      engagement_score: Math.round(engagementScore),
    };
  }

  /**
   * Get or create customer preferences
   */
  async getCustomerPreferences(customerId: number): Promise<CustomerPreference | null> {
    let preferences = await this.communicationRepository.getCustomerPreferences(customerId);
    
    if (!preferences) {
      // Create default preferences
      preferences = await this.communicationRepository.createOrUpdateCustomerPreferences(customerId, {
        sms_enabled: true,
        email_enabled: true,
        preferred_time_start: '09:00:00',
        preferred_time_end: '17:00:00',
        timezone: 'America/Chicago',
        language: 'en',
      });
    }

    return preferences;
  }

  /**
   * Update customer communication preferences
   */
  async updateCustomerPreferences(
    customerId: number,
    preferences: Partial<Omit<CustomerPreference, 'id' | 'customer_id' | 'updated_at'>>
  ): Promise<CustomerPreference> {
    const updatedPreferences = await this.communicationRepository.createOrUpdateCustomerPreferences(
      customerId,
      preferences
    );

    this.logger.info('Customer preferences updated', {
      customerId,
      changes: Object.keys(preferences),
    });

    return updatedPreferences;
  }

  /**
   * Opt out customer from communications
   */
  async optOutCustomer(
    customerId: number,
    type: 'sms' | 'email' | 'all',
    reason?: string
  ): Promise<CustomerPreference> {
    const preferences = await this.communicationRepository.optOutCustomer(customerId, type, reason);

    this.logger.info('Customer opted out', {
      customerId,
      type,
      reason,
    });

    // Log the opt-out as a communication
    await this.logCommunication({
      shopId: 0, // Will need actual shop ID
      customerId,
      type: 'sms', // Type of opt-out
      direction: 'inbound',
      content: `Customer opted out of ${type} communications. Reason: ${reason || 'Not specified'}`,
      metadata: {
        opt_out: true,
        opt_out_type: type,
        opt_out_reason: reason,
      },
    });

    return preferences;
  }

  /**
   * Check if customer can receive communication type at current time
   */
  async canReceiveCommunication(
    customerId: number,
    type: 'sms' | 'email',
    scheduledTime?: Date
  ): Promise<{ canReceive: boolean; reason?: string }> {
    const preferences = await this.getCustomerPreferences(customerId);
    
    if (!preferences) {
      return { canReceive: true }; // Default to allowing if no preferences
    }

    // Check if opted out
    const isEnabled = type === 'sms' ? preferences.sms_enabled : preferences.email_enabled;
    if (!isEnabled) {
      return { canReceive: false, reason: `Customer opted out of ${type} communications` };
    }

    // Check time preferences
    const checkTime = scheduledTime || new Date();
    const userTime = this.convertToUserTimezone(checkTime, preferences.timezone);
    const currentHour = userTime.getHours();
    const currentMinute = userTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = preferences.preferred_time_start.split(':').map(Number);
    const [endHour, endMinute] = preferences.preferred_time_end.split(':').map(Number);
    
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    if (currentTimeMinutes < startTimeMinutes || currentTimeMinutes > endTimeMinutes) {
      return { 
        canReceive: false, 
        reason: `Outside customer's preferred communication window (${preferences.preferred_time_start} - ${preferences.preferred_time_end} ${preferences.timezone})` 
      };
    }

    return { canReceive: true };
  }

  /**
   * Get communication template
   */
  getTemplate(key: string): CommunicationTemplate | null {
    return this.templates.find(template => template.key === key) || null;
  }

  /**
   * Render template with variables
   */
  renderTemplate(templateKey: string, variables: Record<string, string>): string | null {
    const template = this.getTemplate(templateKey);
    if (!template) {
      return null;
    }

    let renderedContent = template.content;
    
    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      renderedContent = renderedContent.replace(new RegExp(placeholder, 'g'), value);
    }

    // Check for unreplaced variables
    const unreplacedVars = renderedContent.match(/\{\{([^}]+)\}\}/g);
    if (unreplacedVars) {
      this.logger.warn(`Unreplaced variables in template ${templateKey}:`, unreplacedVars);
    }

    return renderedContent;
  }

  /**
   * Process scheduled communications
   */
  async processScheduledCommunications(): Promise<number> {
    const scheduledComms = await this.communicationRepository.getScheduledCommunications(new Date());
    let processedCount = 0;

    for (const comm of scheduledComms) {
      try {
        // Check if customer can receive communication
        if (comm.customer_id) {
          const canReceive = await this.canReceiveCommunication(
            comm.customer_id,
            comm.communication_type as 'sms' | 'email'
          );

          if (!canReceive.canReceive) {
            this.logger.info('Skipping scheduled communication', {
              communicationId: comm.id,
              reason: canReceive.reason,
            });
            continue;
          }
        }

        // TODO: Actually send the communication via appropriate service
        // For now, just mark as processed
        await this.communicationRepository.markCommunicationProcessed(comm.id);
        processedCount++;

        this.logger.info('Scheduled communication processed', {
          communicationId: comm.id,
          type: comm.communication_type,
          customerId: comm.customer_id,
        });

      } catch (error) {
        this.logger.error(`Failed to process scheduled communication ${comm.id}:`, error);
      }
    }

    if (processedCount > 0) {
      this.logger.info('Scheduled communications processed', { count: processedCount });
    }

    return processedCount;
  }

  /**
   * Get shop communication statistics
   */
  async getShopStats(shopId: number, startDate: Date, endDate: Date) {
    return this.communicationRepository.getCommunicationStats(shopId, startDate, endDate);
  }

  /**
   * Get customers by timezone for batch communications
   */
  async getCustomersByTimeZone(shopId: number, timezone: string, type: 'sms' | 'email') {
    return this.communicationRepository.getCustomersInTimeZone(shopId, timezone, type);
  }

  // Private helper methods

  private convertToUserTimezone(date: Date, timezone: string): Date {
    // Simple timezone conversion - in production, use a proper timezone library
    const timezoneOffsets: Record<string, number> = {
      'America/Chicago': -6, // CST
      'America/New_York': -5, // EST
      'America/Los_Angeles': -8, // PST
      'America/Denver': -7, // MST
    };

    const offset = timezoneOffsets[timezone] || -6; // Default to CST
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    return new Date(utc + (offset * 3600000));
  }
}
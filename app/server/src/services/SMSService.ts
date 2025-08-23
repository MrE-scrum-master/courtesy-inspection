import axios, { AxiosInstance } from 'axios';
import { Pool } from 'pg';
import { SMSRepository, SMSMessage, CreateSMSMessageData, UpdateSMSMessageData } from '../repositories/SMSRepository';
import { telnyxConfig, TelnyxMessage, TelnyxResponse, SMS_STATUS, MESSAGE_DIRECTION, smsRateLimiter, RateLimiter, validateTelnyxConfig } from '../config/telnyx.config';
import { CircuitBreaker } from '../utils/CircuitBreaker';
import { Logger } from '../utils/Logger';

export interface SendSMSOptions {
  to: string;
  message: string;
  customerId?: number;
  inspectionId?: number;
  shopId?: number;
  fromNumber?: string;
  messagingProfileId?: string;
  webhookUrl?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface SMSTemplateVars {
  [key: string]: string | number;
}

export interface PhoneValidationResult {
  isValid: boolean;
  formattedNumber: string;
  carrier?: string;
  lineType?: string;
  country?: string;
}

export class SMSService {
  private readonly smsRepository: SMSRepository;
  private readonly httpClient: AxiosInstance;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly logger: Logger;
  private readonly rateLimiter: RateLimiter;

  constructor(pool: Pool) {
    validateTelnyxConfig();
    
    this.smsRepository = new SMSRepository(pool);
    this.logger = new Logger('SMSService');
    this.rateLimiter = smsRateLimiter;
    
    this.httpClient = axios.create({
      baseURL: telnyxConfig.apiBaseUrl,
      headers: {
        'Authorization': `Bearer ${telnyxConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: telnyxConfig.messageTimeout,
    });

    this.circuitBreaker = new CircuitBreaker(
      this.sendMessageToTelnyx.bind(this),
      {
        timeout: telnyxConfig.messageTimeout,
        errorThresholdPercentage: 50,
        resetTimeout: 60000, // 1 minute
        minimumNumberOfCalls: 5,
      }
    );

    this.setupAxiosInterceptors();
  }

  private setupAxiosInterceptors(): void {
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`SMS API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('SMS API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`SMS API Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        this.logger.error('SMS API Response Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Send SMS using template with variable substitution
   */
  async sendTemplatedSMS(
    templateKey: string,
    variables: SMSTemplateVars,
    options: Omit<SendSMSOptions, 'message'>
  ): Promise<SMSMessage> {
    const template = await this.smsRepository.getTemplate(options.shopId || null, templateKey);
    
    if (!template) {
      throw new Error(`SMS template not found: ${templateKey}`);
    }

    let message = template.message_text;

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      message = message.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Check for unreplaced variables
    const unreplacedVars = message.match(/\{\{([^}]+)\}\}/g);
    if (unreplacedVars) {
      this.logger.warn(`Unreplaced variables in SMS template ${templateKey}:`, unreplacedVars);
    }

    return this.sendSMS({ ...options, message });
  }

  /**
   * Send inspection ready notification to customer
   */
  async sendInspectionReady(
    customerId: number,
    inspectionId: number,
    shortLink: string,
    customerData: {
      name: string;
      phone: string;
      vehicle_year?: number;
      vehicle_make?: string;
      vehicle_model?: string;
    },
    shopId?: number
  ): Promise<SMSMessage> {
    const variables: SMSTemplateVars = {
      customer_name: customerData.name,
      year: customerData.vehicle_year || 'Your',
      make: customerData.vehicle_make || '',
      model: customerData.vehicle_model || 'vehicle',
      short_link: shortLink,
    };

    return this.sendTemplatedSMS('inspection_ready', variables, {
      to: customerData.phone,
      customerId,
      inspectionId,
      shopId,
      priority: 'normal',
    });
  }

  /**
   * Send approval request to manager
   */
  async sendApprovalRequest(
    managerId: number,
    inspectionId: number,
    mechanicName: string,
    managerPhone: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
    shopId?: number
  ): Promise<SMSMessage> {
    const variables: SMSTemplateVars = {
      inspection_id: inspectionId,
      mechanic_name: mechanicName,
      priority: priority.toUpperCase(),
    };

    return this.sendTemplatedSMS('approval_needed', variables, {
      to: managerPhone,
      inspectionId,
      shopId,
      priority,
    });
  }

  /**
   * Send reminder message to customer
   */
  async sendReminderMessage(
    customerId: number,
    message: string,
    customerPhone: string,
    shopId?: number
  ): Promise<SMSMessage> {
    return this.sendSMS({
      to: customerPhone,
      message,
      customerId,
      shopId,
      priority: 'low',
    });
  }

  /**
   * Send templated reminder to customer
   */
  async sendTemplatedReminder(
    customerId: number,
    customerName: string,
    customerPhone: string,
    shopId?: number
  ): Promise<SMSMessage> {
    const variables: SMSTemplateVars = {
      customer_name: customerName,
    };

    return this.sendTemplatedSMS('reminder_follow_up', variables, {
      to: customerPhone,
      customerId,
      shopId,
      priority: 'low',
    });
  }

  /**
   * Core SMS sending method
   */
  async sendSMS(options: SendSMSOptions): Promise<SMSMessage> {
    const { isValid, formattedNumber } = this.validatePhoneNumber(options.to);
    
    if (!isValid) {
      throw new Error(`Invalid phone number: ${options.to}`);
    }

    // Rate limiting check
    if (!this.rateLimiter.canSend()) {
      const delay = this.rateLimiter.getDelay();
      throw new Error(`Rate limit exceeded. Retry in ${delay}ms`);
    }

    const fromNumber = options.fromNumber || telnyxConfig.defaultFromNumber;
    const costCents = this.calculateCost(formattedNumber, options.message);

    // Create message record
    const messageData: CreateSMSMessageData = {
      to_phone: formattedNumber,
      from_phone: fromNumber,
      message_text: options.message,
      message_type: MESSAGE_DIRECTION.OUTBOUND,
      shop_id: options.shopId,
      customer_id: options.customerId,
      inspection_id: options.inspectionId,
      cost_cents: costCents,
    };

    const smsMessage = await this.smsRepository.createMessage(messageData);

    try {
      // Record rate limit
      this.rateLimiter.recordSend();

      // Send via Telnyx with circuit breaker
      const telnyxMessage: TelnyxMessage = {
        to: formattedNumber,
        from: fromNumber,
        text: options.message,
        messaging_profile_id: options.messagingProfileId,
        webhook_url: options.webhookUrl,
        use_profile_webhooks: true,
      };

      const response = await this.circuitBreaker.execute(telnyxMessage);

      // Update message with Telnyx ID and status
      await this.smsRepository.updateMessage(smsMessage.id, {
        telnyx_message_id: response.data.id,
        status: SMS_STATUS.SENT,
      });

      this.logger.info(`SMS sent successfully`, {
        messageId: smsMessage.id,
        telnyxId: response.data.id,
        to: formattedNumber,
        costCents,
      });

      return { ...smsMessage, telnyx_message_id: response.data.id, status: SMS_STATUS.SENT };

    } catch (error) {
      // Update message with failure
      await this.smsRepository.updateMessage(smsMessage.id, {
        status: SMS_STATUS.FAILED,
        failed_at: new Date(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      this.logger.error(`SMS send failed`, {
        messageId: smsMessage.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        to: formattedNumber,
      });

      throw error;
    }
  }

  /**
   * Handle inbound SMS messages
   */
  async handleInboundSMS(from: string, to: string, text: string, telnyxData?: any): Promise<SMSMessage> {
    const { isValid, formattedNumber } = this.validatePhoneNumber(from);
    
    if (!isValid) {
      throw new Error(`Invalid sender phone number: ${from}`);
    }

    // Try to find customer by phone number
    // This would require a customer repository - placeholder for now
    const customerId = await this.findCustomerByPhone(formattedNumber);

    const messageData: CreateSMSMessageData = {
      telnyx_message_id: telnyxData?.id,
      to_phone: to,
      from_phone: formattedNumber,
      message_text: text,
      message_type: MESSAGE_DIRECTION.INBOUND,
      customer_id: customerId,
    };

    const smsMessage = await this.smsRepository.createMessage({
      ...messageData,
      cost_cents: 0, // Inbound messages are free
    });

    // Update status to received
    await this.smsRepository.updateMessage(smsMessage.id, {
      status: SMS_STATUS.RECEIVED,
    });

    this.logger.info(`Inbound SMS received`, {
      messageId: smsMessage.id,
      from: formattedNumber,
      to,
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
    });

    // TODO: Implement auto-response logic here
    await this.processInboundMessage(smsMessage, text);

    return smsMessage;
  }

  /**
   * Get delivery status for a message
   */
  async getDeliveryStatus(messageId: number): Promise<{ status: string; deliveredAt?: Date; failedAt?: Date }> {
    const message = await this.smsRepository.getMessageById(messageId);
    
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    return {
      status: message.status,
      deliveredAt: message.delivered_at || undefined,
      failedAt: message.failed_at || undefined,
    };
  }

  /**
   * Calculate SMS cost based on destination and length
   */
  calculateCost(phoneNumber: string, message: string): number {
    // Basic cost calculation - can be enhanced with carrier-specific pricing
    const messageLength = message.length;
    const segments = Math.ceil(messageLength / 160); // Standard SMS segment length
    const baseCost = telnyxConfig.costPerSMS;
    
    // International rates (simplified)
    const isInternational = !phoneNumber.startsWith('+1');
    const internationalMultiplier = isInternational ? 2.5 : 1;
    
    return Math.round(baseCost * segments * internationalMultiplier);
  }

  /**
   * Validate and format phone number
   */
  validatePhoneNumber(phoneNumber: string): PhoneValidationResult {
    // Remove all non-digits
    const digits = phoneNumber.replace(/\D/g, '');
    
    let formattedNumber: string;
    
    // Handle different formats
    if (digits.length === 10) {
      // US number without country code
      formattedNumber = `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      // US number with country code
      formattedNumber = `+${digits}`;
    } else if (digits.length >= 10 && digits.length <= 15) {
      // International number
      formattedNumber = `+${digits}`;
    } else {
      return { isValid: false, formattedNumber: phoneNumber };
    }

    // Basic validation regex for common formats
    const phoneRegex = /^\+[1-9]\d{7,14}$/;
    const isValid = phoneRegex.test(formattedNumber);

    return {
      isValid,
      formattedNumber,
      // Additional carrier/line type info would come from Telnyx lookup API
    };
  }

  /**
   * Get SMS conversation history for a phone number
   */
  async getConversationHistory(phoneNumber: string, limit: number = 20): Promise<SMSMessage[]> {
    const { isValid, formattedNumber } = this.validatePhoneNumber(phoneNumber);
    
    if (!isValid) {
      throw new Error(`Invalid phone number: ${phoneNumber}`);
    }

    return this.smsRepository.getRecentConversation(formattedNumber, limit);
  }

  /**
   * Retry failed messages
   */
  async retryFailedMessages(limit: number = 10): Promise<SMSMessage[]> {
    const failedMessages = await this.smsRepository.getFailedMessages(limit);
    const retriedMessages: SMSMessage[] = [];

    for (const message of failedMessages) {
      try {
        // Only retry messages that failed less than 3 times
        const retryCount = message.webhook_data?.retry_count || 0;
        if (retryCount >= 3) {
          continue;
        }

        const options: SendSMSOptions = {
          to: message.to_phone,
          message: message.message_text,
          customerId: message.customer_id || undefined,
          inspectionId: message.inspection_id || undefined,
          shopId: message.shop_id || undefined,
        };

        const retriedMessage = await this.sendSMS(options);
        
        // Update retry count
        await this.smsRepository.updateMessage(message.id, {
          webhook_data: { ...message.webhook_data, retry_count: retryCount + 1 },
        });

        retriedMessages.push(retriedMessage);
        
        // Rate limiting between retries
        await this.sleep(1000);
        
      } catch (error) {
        this.logger.error(`Failed to retry message ${message.id}:`, error);
      }
    }

    return retriedMessages;
  }

  /**
   * Get SMS statistics for a shop
   */
  async getShopSMSStats(shopId: number, startDate: Date, endDate: Date) {
    return this.smsRepository.getSMSStats(shopId, startDate, endDate);
  }

  // Private helper methods

  private async sendMessageToTelnyx(telnyxMessage: TelnyxMessage): Promise<TelnyxResponse> {
    const response = await this.httpClient.post('/messages', telnyxMessage);
    return response.data;
  }

  private async findCustomerByPhone(phoneNumber: string): Promise<number | null> {
    // TODO: Implement customer lookup by phone number
    // This would query the customers table
    return null;
  }

  private async processInboundMessage(message: SMSMessage, text: string): Promise<void> {
    // TODO: Implement auto-response logic
    // Could check for keywords like "STOP", "HELP", etc.
    // Could trigger automated responses or notifications
    
    const lowerText = text.toLowerCase().trim();
    
    if (lowerText === 'stop' || lowerText === 'unsubscribe') {
      // Handle opt-out
      await this.handleOptOut(message.from_phone);
    } else if (lowerText === 'help') {
      // Send help message
      await this.sendHelpMessage(message.from_phone);
    }
  }

  private async handleOptOut(phoneNumber: string): Promise<void> {
    // TODO: Implement opt-out functionality
    // Update customer preferences to disable SMS
    this.logger.info(`Opt-out request received from ${phoneNumber}`);
  }

  private async sendHelpMessage(phoneNumber: string): Promise<void> {
    // TODO: Send automated help response
    this.logger.info(`Help request received from ${phoneNumber}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
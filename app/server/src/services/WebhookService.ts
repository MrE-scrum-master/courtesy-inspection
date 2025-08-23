import crypto from 'crypto';
import { Pool } from 'pg';
import { SMSRepository, UpdateSMSMessageData } from '../repositories/SMSRepository';
import { CommunicationService } from './CommunicationService';
import { telnyxConfig, TelnyxWebhook, TELNYX_EVENT_TYPES, SMS_STATUS, MESSAGE_DIRECTION } from '../config/telnyx.config';
import { Logger } from '../utils/Logger';

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ProcessedWebhook {
  id: string;
  event_type: string;
  processed_at: Date;
  success: boolean;
  error?: string;
}

export interface WebhookRetryOptions {
  webhookId: string;
  maxRetries?: number;
  retryDelay?: number;
}

export class WebhookService {
  private readonly smsRepository: SMSRepository;
  private readonly communicationService: CommunicationService;
  private readonly logger: Logger;
  private readonly pool: Pool;

  // Webhook processing registry
  private readonly processors = new Map<string, (webhook: TelnyxWebhook) => Promise<void>>();

  constructor(pool: Pool) {
    this.pool = pool;
    this.smsRepository = new SMSRepository(pool);
    this.communicationService = new CommunicationService(pool);
    this.logger = new Logger('WebhookService');

    this.initializeProcessors();
  }

  /**
   * Verify webhook signature from Telnyx
   */
  verifyWebhookSignature(payload: string, signature: string): WebhookValidationResult {
    if (!telnyxConfig.webhookSigningSecret) {
      this.logger.warn('Webhook signing secret not configured');
      return { isValid: false, error: 'Webhook signing secret not configured' };
    }

    if (!signature) {
      return { isValid: false, error: 'Missing webhook signature' };
    }

    try {
      // Telnyx uses HMAC-SHA256 with the format: t=timestamp,v1=signature
      const parts = signature.split(',');
      let timestamp = '';
      let providedSignature = '';

      for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 't') {
          timestamp = value;
        } else if (key === 'v1') {
          providedSignature = value;
        }
      }

      if (!timestamp || !providedSignature) {
        return { isValid: false, error: 'Invalid signature format' };
      }

      // Check timestamp (prevent replay attacks)
      const webhookTimestamp = parseInt(timestamp, 10);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const timeDifference = Math.abs(currentTimestamp - webhookTimestamp);

      if (timeDifference > 300) { // 5 minutes tolerance
        return { isValid: false, error: 'Webhook timestamp too old' };
      }

      // Create expected signature
      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', telnyxConfig.webhookSigningSecret)
        .update(signedPayload, 'utf8')
        .digest('hex');

      // Compare signatures using constant-time comparison
      const isValid = crypto.timingSafeEqual(
        Buffer.from(providedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      if (!isValid) {
        return { isValid: false, error: 'Invalid webhook signature' };
      }

      return { isValid: true };

    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      return { isValid: false, error: 'Signature verification failed' };
    }
  }

  /**
   * Process incoming webhook from Telnyx
   */
  async processWebhook(webhook: TelnyxWebhook): Promise<ProcessedWebhook> {
    const startTime = Date.now();
    const webhookId = webhook.data.id;

    this.logger.info('Processing webhook', {
      id: webhookId,
      eventType: webhook.data.event_type,
      messageId: webhook.data.payload.id,
    });

    try {
      // Check for duplicate processing (idempotency)
      if (await this.isDuplicateWebhook(webhookId)) {
        this.logger.info('Duplicate webhook ignored', { id: webhookId });
        return {
          id: webhookId,
          event_type: webhook.data.event_type,
          processed_at: new Date(),
          success: true,
        };
      }

      // Get processor for event type
      const processor = this.processors.get(webhook.data.event_type);
      if (!processor) {
        this.logger.warn('No processor found for event type', {
          eventType: webhook.data.event_type,
          webhookId,
        });
        
        // Still mark as processed to avoid reprocessing
        await this.markWebhookProcessed(webhookId, true);
        
        return {
          id: webhookId,
          event_type: webhook.data.event_type,
          processed_at: new Date(),
          success: true,
        };
      }

      // Process the webhook
      await processor(webhook);

      // Mark as successfully processed
      await this.markWebhookProcessed(webhookId, true);

      const processingTime = Date.now() - startTime;
      this.logger.info('Webhook processed successfully', {
        id: webhookId,
        eventType: webhook.data.event_type,
        processingTimeMs: processingTime,
      });

      return {
        id: webhookId,
        event_type: webhook.data.event_type,
        processed_at: new Date(),
        success: true,
      };

    } catch (error) {
      // Mark as failed for retry
      await this.markWebhookProcessed(webhookId, false, error instanceof Error ? error.message : 'Unknown error');

      const processingTime = Date.now() - startTime;
      this.logger.error('Webhook processing failed', {
        id: webhookId,
        eventType: webhook.data.event_type,
        processingTimeMs: processingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        id: webhookId,
        event_type: webhook.data.event_type,
        processed_at: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle SMS status update webhooks
   */
  async handleSMSStatusUpdate(webhook: TelnyxWebhook): Promise<void> {
    const payload = webhook.data.payload;
    const telnyxMessageId = payload.id;
    const eventType = webhook.data.event_type;

    this.logger.debug('Handling SMS status update', {
      telnyxMessageId,
      eventType,
      status: payload.to[0]?.status,
    });

    // Find the SMS message in our database
    const smsMessage = await this.smsRepository.getMessageByTelnyxId(telnyxMessageId);
    if (!smsMessage) {
      this.logger.warn('SMS message not found for Telnyx ID', { telnyxMessageId });
      return;
    }

    // Determine new status and update data
    const updateData: UpdateSMSMessageData = {
      webhook_data: payload,
    };

    switch (eventType) {
      case TELNYX_EVENT_TYPES.MESSAGE_SENT:
        updateData.status = SMS_STATUS.SENT;
        break;

      case TELNYX_EVENT_TYPES.MESSAGE_DELIVERED:
        updateData.status = SMS_STATUS.DELIVERED;
        updateData.delivered_at = new Date();
        break;

      case TELNYX_EVENT_TYPES.MESSAGE_FAILED:
        updateData.status = SMS_STATUS.FAILED;
        updateData.failed_at = new Date();
        updateData.error_message = payload.errors?.[0]?.detail || 'Message delivery failed';
        break;

      case TELNYX_EVENT_TYPES.MESSAGE_FINALIZED:
        // Update cost information if available
        if (payload.cost) {
          const costCents = Math.round(parseFloat(payload.cost.amount) * 100);
          updateData.cost_cents = costCents;
        }
        break;
    }

    // Update the SMS message
    await this.smsRepository.updateMessageByTelnyxId(telnyxMessageId, updateData);

    // Log communication status update
    if (smsMessage.customer_id) {
      await this.communicationService.logCommunication({
        shopId: smsMessage.shop_id || 0,
        customerId: smsMessage.customer_id,
        inspectionId: smsMessage.inspection_id || undefined,
        type: 'sms',
        direction: 'outbound',
        content: `SMS status update: ${eventType}`,
        status: updateData.status as any,
        metadata: {
          webhook_event: eventType,
          telnyx_message_id: telnyxMessageId,
          original_message_id: smsMessage.id,
        },
      });
    }

    this.logger.info('SMS status updated', {
      smsMessageId: smsMessage.id,
      telnyxMessageId,
      eventType,
      newStatus: updateData.status,
    });
  }

  /**
   * Handle inbound SMS webhooks
   */
  async handleInboundSMS(webhook: TelnyxWebhook): Promise<void> {
    const payload = webhook.data.payload;
    const fromNumber = payload.from.phone_number;
    const toNumber = payload.to[0].phone_number;
    const messageText = payload.text;

    this.logger.info('Handling inbound SMS', {
      from: fromNumber,
      to: toNumber,
      messageLength: messageText.length,
      telnyxId: payload.id,
    });

    // Create inbound SMS record
    const smsMessage = await this.smsRepository.createMessage({
      telnyx_message_id: payload.id,
      to_phone: toNumber,
      from_phone: fromNumber,
      message_text: messageText,
      message_type: MESSAGE_DIRECTION.INBOUND,
      cost_cents: 0, // Inbound messages are typically free
    });

    // Update status to received
    await this.smsRepository.updateMessage(smsMessage.id, {
      status: SMS_STATUS.RECEIVED,
      webhook_data: payload,
    });

    // Try to find the customer by phone number
    const customerId = await this.findCustomerByPhone(fromNumber);

    if (customerId) {
      // Update the SMS message with customer ID
      await this.smsRepository.updateMessage(smsMessage.id, {
        customer_id: customerId,
      });

      // Log the communication
      await this.communicationService.logCommunication({
        shopId: 0, // Will need to be determined from customer
        customerId,
        type: 'sms',
        direction: 'inbound',
        content: messageText,
        status: 'received',
        metadata: {
          telnyx_message_id: payload.id,
          sms_message_id: smsMessage.id,
          auto_reply_eligible: true,
        },
      });

      // Process auto-responses
      await this.processAutoResponse(customerId, messageText, fromNumber);
    }

    this.logger.info('Inbound SMS processed', {
      smsMessageId: smsMessage.id,
      customerId,
      from: fromNumber,
    });
  }

  /**
   * Retry failed webhooks
   */
  async retryFailedWebhooks(webhookIds: string[], options: Partial<WebhookRetryOptions> = {}): Promise<ProcessedWebhook[]> {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    const retryResults: ProcessedWebhook[] = [];

    for (const webhookId of webhookIds) {
      try {
        // Get webhook data from failed webhooks storage
        const webhookData = await this.getFailedWebhookData(webhookId);
        if (!webhookData) {
          this.logger.warn('Failed webhook data not found', { webhookId });
          continue;
        }

        // Check retry count
        const retryCount = webhookData.retry_count || 0;
        if (retryCount >= maxRetries) {
          this.logger.warn('Webhook exceeded max retries', { webhookId, retryCount, maxRetries });
          continue;
        }

        // Increment retry count
        await this.incrementWebhookRetryCount(webhookId);

        // Retry processing
        const result = await this.processWebhook(webhookData.webhook);
        retryResults.push(result);

        if (result.success) {
          await this.removeFromFailedWebhooks(webhookId);
        }

        // Delay between retries
        if (retryDelay > 0) {
          await this.sleep(retryDelay);
        }

      } catch (error) {
        this.logger.error(`Failed to retry webhook ${webhookId}:`, error);
      }
    }

    this.logger.info('Webhook retry completed', {
      requestedCount: webhookIds.length,
      processedCount: retryResults.length,
      successCount: retryResults.filter(r => r.success).length,
    });

    return retryResults;
  }

  /**
   * Get webhook processing statistics
   */
  async getWebhookStats(startDate: Date, endDate: Date): Promise<{
    total_processed: number;
    successful: number;
    failed: number;
    by_event_type: Record<string, number>;
    average_processing_time: number;
  }> {
    // This would be implemented with a webhook_processing_log table
    // For now, return basic structure
    return {
      total_processed: 0,
      successful: 0,
      failed: 0,
      by_event_type: {},
      average_processing_time: 0,
    };
  }

  // Private helper methods

  private initializeProcessors(): void {
    // SMS status update processors
    this.processors.set(TELNYX_EVENT_TYPES.MESSAGE_SENT, this.handleSMSStatusUpdate.bind(this));
    this.processors.set(TELNYX_EVENT_TYPES.MESSAGE_DELIVERED, this.handleSMSStatusUpdate.bind(this));
    this.processors.set(TELNYX_EVENT_TYPES.MESSAGE_FAILED, this.handleSMSStatusUpdate.bind(this));
    this.processors.set(TELNYX_EVENT_TYPES.MESSAGE_FINALIZED, this.handleSMSStatusUpdate.bind(this));

    // Inbound message processor
    this.processors.set(TELNYX_EVENT_TYPES.MESSAGE_RECEIVED, this.handleInboundSMS.bind(this));
  }

  private async isDuplicateWebhook(webhookId: string): Promise<boolean> {
    // Check if webhook has already been processed
    // This would use a webhook_processing_log table
    const query = `
      SELECT 1 FROM webhook_processing_log 
      WHERE webhook_id = $1 AND success = true
      LIMIT 1
    `;
    
    try {
      const result = await this.pool.query(query, [webhookId]);
      return result.rows.length > 0;
    } catch (error) {
      // If table doesn't exist, assume not duplicate
      return false;
    }
  }

  private async markWebhookProcessed(webhookId: string, success: boolean, error?: string): Promise<void> {
    // Record webhook processing result
    const query = `
      INSERT INTO webhook_processing_log (
        webhook_id, success, error_message, processed_at
      ) VALUES ($1, $2, $3, NOW())
      ON CONFLICT (webhook_id) 
      DO UPDATE SET 
        success = EXCLUDED.success,
        error_message = EXCLUDED.error_message,
        processed_at = EXCLUDED.processed_at
    `;

    try {
      await this.pool.query(query, [webhookId, success, error || null]);
    } catch (dbError) {
      // If table doesn't exist, log but don't fail
      this.logger.debug('Could not mark webhook as processed (table may not exist)', {
        webhookId,
        success,
        error: dbError,
      });
    }
  }

  private async findCustomerByPhone(phoneNumber: string): Promise<number | null> {
    const query = 'SELECT id FROM customers WHERE phone = $1 LIMIT 1';
    try {
      const result = await this.pool.query(query, [phoneNumber]);
      return result.rows[0]?.id || null;
    } catch (error) {
      this.logger.error('Failed to find customer by phone:', error);
      return null;
    }
  }

  private async processAutoResponse(customerId: number, messageText: string, phoneNumber: string): Promise<void> {
    const lowerText = messageText.toLowerCase().trim();

    // Handle common keywords
    if (lowerText === 'stop' || lowerText === 'unsubscribe') {
      await this.handleOptOut(customerId, phoneNumber);
    } else if (lowerText === 'help') {
      await this.sendHelpResponse(phoneNumber);
    } else if (lowerText === 'status') {
      await this.sendStatusResponse(customerId, phoneNumber);
    }
    // Add more auto-response logic as needed
  }

  private async handleOptOut(customerId: number, phoneNumber: string): Promise<void> {
    try {
      await this.communicationService.optOutCustomer(customerId, 'sms', 'Customer requested via SMS');
      
      // TODO: Send confirmation SMS
      this.logger.info('Customer opted out via SMS', { customerId, phoneNumber });
    } catch (error) {
      this.logger.error('Failed to process opt-out:', error);
    }
  }

  private async sendHelpResponse(phoneNumber: string): Promise<void> {
    // TODO: Send help message via SMS service
    this.logger.info('Help response needed', { phoneNumber });
  }

  private async sendStatusResponse(customerId: number, phoneNumber: string): Promise<void> {
    // TODO: Send status information via SMS service
    this.logger.info('Status response needed', { customerId, phoneNumber });
  }

  private async getFailedWebhookData(webhookId: string): Promise<any> {
    // This would retrieve webhook data from failed_webhooks table
    return null;
  }

  private async incrementWebhookRetryCount(webhookId: string): Promise<void> {
    // This would increment retry count in failed_webhooks table
  }

  private async removeFromFailedWebhooks(webhookId: string): Promise<void> {
    // This would remove webhook from failed_webhooks table
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
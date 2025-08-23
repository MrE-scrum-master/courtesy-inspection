import { Request, Response } from 'express';
import { Pool } from 'pg';
import { WebhookService } from '../services/WebhookService';
import { Logger } from '../utils/Logger';

export class WebhookController {
  private readonly webhookService: WebhookService;
  private readonly logger: Logger;

  constructor(pool: Pool) {
    this.webhookService = new WebhookService(pool);
    this.logger = new Logger('WebhookController');
  }

  /**
   * Handle Telnyx webhooks
   */
  handleTelnyxWebhook = async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const signature = req.headers['telnyx-signature-ed25519'] as string;
    const timestamp = req.headers['telnyx-timestamp'] as string;

    try {
      // Get raw body for signature verification
      const rawBody = JSON.stringify(req.body);

      // Verify webhook signature
      const verification = this.webhookService.verifyWebhookSignature(rawBody, signature);
      
      if (!verification.isValid) {
        this.logger.warn('Invalid webhook signature', {
          error: verification.error,
          timestamp,
          ip: req.ip,
        });
        
        res.status(401).json({
          error: 'Invalid webhook signature',
          details: verification.error,
        });
        return;
      }

      // Process the webhook
      const webhookData = req.body;
      const result = await this.webhookService.processWebhook(webhookData);

      const processingTime = Date.now() - startTime;
      
      this.logger.info('Webhook processed', {
        id: result.id,
        eventType: result.event_type,
        success: result.success,
        processingTimeMs: processingTime,
      });

      // Return success response
      res.status(200).json({
        success: true,
        webhook_id: result.id,
        processed_at: result.processed_at,
        processing_time_ms: processingTime,
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error('Webhook processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
        processingTimeMs: processingTime,
        ip: req.ip,
      });

      res.status(500).json({
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime,
      });
    }
  };

  /**
   * Handle webhook retry requests
   */
  retryWebhooks = async (req: Request, res: Response): Promise<void> => {
    try {
      const { webhook_ids, max_retries, retry_delay } = req.body;

      if (!webhook_ids || !Array.isArray(webhook_ids)) {
        res.status(400).json({
          error: 'webhook_ids must be an array',
        });
        return;
      }

      const options = {
        maxRetries: max_retries || 3,
        retryDelay: retry_delay || 1000,
      };

      const results = await this.webhookService.retryFailedWebhooks(webhook_ids, options);

      res.json({
        success: true,
        requested_count: webhook_ids.length,
        processed_count: results.length,
        success_count: results.filter(r => r.success).length,
        results,
      });

    } catch (error) {
      this.logger.error('Webhook retry failed:', error);
      
      res.status(500).json({
        error: 'Webhook retry failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Get webhook processing statistics
   */
  getWebhookStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        res.status(400).json({
          error: 'start_date and end_date are required',
        });
        return;
      }

      const startDate = new Date(start_date as string);
      const endDate = new Date(end_date as string);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({
          error: 'Invalid date format',
        });
        return;
      }

      const stats = await this.webhookService.getWebhookStats(startDate, endDate);

      res.json({
        success: true,
        period: {
          start_date: startDate,
          end_date: endDate,
        },
        stats,
      });

    } catch (error) {
      this.logger.error('Failed to get webhook stats:', error);
      
      res.status(500).json({
        error: 'Failed to get webhook stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Health check endpoint for webhook service
   */
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        service: 'webhook',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Health check failed',
      });
    }
  };

  /**
   * Test webhook endpoint for development
   */
  testWebhook = async (req: Request, res: Response): Promise<void> => {
    if (process.env.NODE_ENV === 'production') {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    try {
      const testWebhookData = {
        data: {
          event_type: 'message.sent',
          id: `test-${Date.now()}`,
          occurred_at: new Date().toISOString(),
          payload: {
            id: `msg-test-${Date.now()}`,
            record_type: 'message',
            direction: 'outbound',
            to: [{ phone_number: '+1234567890', status: 'sent' }],
            from: { phone_number: '+1987654321' },
            text: 'Test message',
            messaging_profile_id: 'test-profile',
            parts: 1,
            tags: [],
            sent_at: new Date().toISOString(),
            encoding: 'GSM-7',
            ...req.body.payload,
          },
        },
      };

      const result = await this.webhookService.processWebhook(testWebhookData);

      res.json({
        success: true,
        message: 'Test webhook processed',
        result,
      });

    } catch (error) {
      this.logger.error('Test webhook failed:', error);
      
      res.status(500).json({
        error: 'Test webhook failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}
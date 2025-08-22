// SMS Service - Business logic for SMS notifications
// Integrates sms-templates.js with Telnyx API and service layer validation

import { SendSMSDTO, SMSTemplateDataDTO } from '../types/dtos';
import { ServiceResult, AppError, HttpStatus } from '../types/common';

// Import the SMS templates from templates directory
const SMSTemplates = require('../../../../templates/sms-templates');

export class SMSService {
  private smsTemplates: any;
  private telnyxApiKey: string;
  private telnyxPhoneNumber: string;
  private baseUrl: string;

  constructor() {
    this.smsTemplates = new SMSTemplates();
    this.telnyxApiKey = process.env.TELNYX_API_KEY || '';
    this.telnyxPhoneNumber = process.env.TELNYX_PHONE_NUMBER || '';
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    if (!this.telnyxApiKey) {
      console.warn('TELNYX_API_KEY not set in environment');
    }
  }

  // Send single SMS message
  async sendSMS(data: SendSMSDTO): Promise<ServiceResult<{ messageId: string; status: string }>> {
    try {
      // Validate phone number format
      const validatedPhone = this.validatePhoneNumber(data.to);
      if (!validatedPhone.success) {
        return validatedPhone;
      }

      // Validate template data
      const templateValidation = this.validateTemplateData(data.template, data.data);
      if (!templateValidation.success) {
        return templateValidation;
      }

      // Format message using template
      let formattedMessage;
      try {
        formattedMessage = this.smsTemplates.formatForTelnyx(
          validatedPhone.data!.phone,
          data.template,
          data.data
        );
      } catch (error) {
        return {
          success: false,
          error: `Template formatting error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      // Send SMS via Telnyx API (if API key is configured)
      if (this.telnyxApiKey) {
        try {
          const response = await this.sendViaTelnyx(formattedMessage);
          return {
            success: true,
            data: response
          };
        } catch (error) {
          console.error('Telnyx API error:', error);
          return {
            success: false,
            error: 'SMS delivery failed',
            statusCode: HttpStatus.SERVICE_UNAVAILABLE
          };
        }
      } else {
        // Development mode - log message instead of sending
        console.log('📱 SMS Message (Development Mode):');
        console.log(`To: ${formattedMessage.to}`);
        console.log(`From: ${formattedMessage.from}`);
        console.log(`Message: ${formattedMessage.text}`);
        console.log(`Template: ${formattedMessage.metadata.template}`);
        console.log('---');

        return {
          success: true,
          data: {
            messageId: `dev-${Date.now()}`,
            status: 'queued'
          }
        };
      }

    } catch (error) {
      console.error('SMS sending error:', error);
      return {
        success: false,
        error: 'SMS service error',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Send batch SMS messages
  async sendBatchSMS(messages: SendSMSDTO[]): Promise<ServiceResult<{ sent: number; failed: number; results: any[] }>> {
    try {
      if (!Array.isArray(messages) || messages.length === 0) {
        return {
          success: false,
          error: 'Messages array is required',
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      if (messages.length > 100) {
        return {
          success: false,
          error: 'Batch size too large (max 100 messages)',
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      const results: any[] = [];
      let sent = 0;
      let failed = 0;

      // Process each message
      for (const message of messages) {
        const result = await this.sendSMS(message);
        
        if (result.success) {
          sent++;
        } else {
          failed++;
        }

        results.push({
          to: message.to,
          template: message.template,
          success: result.success,
          error: result.error,
          data: result.data
        });
      }

      return {
        success: true,
        data: {
          sent,
          failed,
          results
        }
      };

    } catch (error) {
      console.error('Batch SMS error:', error);
      return {
        success: false,
        error: 'Batch SMS failed',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Send inspection notification SMS
  async sendInspectionNotification(
    type: 'started' | 'complete' | 'urgent',
    customerPhone: string,
    data: {
      customerName: string;
      shopName: string;
      vehicle: string;
      inspectionId: string;
      shopPhone?: string;
    }
  ): Promise<ServiceResult<{ messageId: string; status: string }>> {
    try {
      // Generate report link
      const reportLink = `${this.baseUrl}/report/${data.inspectionId}`;

      // Map notification type to template
      const templateMap = {
        started: 'inspection_started',
        complete: 'inspection_complete',
        urgent: 'urgent_issue'
      };

      const template = templateMap[type];
      if (!template) {
        return {
          success: false,
          error: 'Invalid notification type',
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      // Prepare SMS data
      const smsData: SendSMSDTO = {
        to: customerPhone,
        template,
        data: {
          customer_name: data.customerName,
          shop_name: data.shopName,
          vehicle: data.vehicle,
          link: reportLink,
          shop_phone: data.shopPhone || '',
          customer_id: '',
          inspection_id: data.inspectionId
        }
      };

      return await this.sendSMS(smsData);

    } catch (error) {
      console.error('Inspection notification error:', error);
      return {
        success: false,
        error: 'Failed to send inspection notification',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Send service reminder SMS
  async sendServiceReminder(
    customerPhone: string,
    data: {
      customerName: string;
      vehicle: string;
      service: string;
      shopPhone: string;
      customerId: string;
    }
  ): Promise<ServiceResult<{ messageId: string; status: string }>> {
    try {
      // Generate booking link
      const bookingLink = `${this.baseUrl}/book/${data.customerId}`;

      const smsData: SendSMSDTO = {
        to: customerPhone,
        template: 'service_reminder',
        data: {
          customer_name: data.customerName,
          vehicle: data.vehicle,
          service: data.service,
          link: bookingLink,
          shop_phone: data.shopPhone,
          customer_id: data.customerId
        }
      };

      return await this.sendSMS(smsData);

    } catch (error) {
      console.error('Service reminder error:', error);
      return {
        success: false,
        error: 'Failed to send service reminder',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Get available SMS templates
  async getAvailableTemplates(): Promise<ServiceResult<any[]>> {
    try {
      const templates = this.smsTemplates.getAvailableTemplates();
      
      return {
        success: true,
        data: templates
      };

    } catch (error) {
      console.error('Get templates error:', error);
      return {
        success: false,
        error: 'Failed to retrieve templates',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Handle SMS webhook from Telnyx
  async handleWebhook(webhookData: any): Promise<ServiceResult<{ processed: boolean }>> {
    try {
      console.log('SMS webhook received:', {
        type: webhookData.event_type,
        messageId: webhookData.payload?.id,
        status: webhookData.payload?.to?.[0]?.status,
        timestamp: webhookData.occurred_at
      });

      // Process different webhook events
      switch (webhookData.event_type) {
        case 'message.sent':
          console.log('SMS sent successfully');
          break;
        case 'message.delivered':
          console.log('SMS delivered');
          break;
        case 'message.delivery_failed':
          console.error('SMS delivery failed:', webhookData.payload?.errors);
          break;
        default:
          console.log('Unknown webhook event:', webhookData.event_type);
      }

      return {
        success: true,
        data: { processed: true }
      };

    } catch (error) {
      console.error('Webhook processing error:', error);
      return {
        success: false,
        error: 'Webhook processing failed',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Private helper methods
  private validatePhoneNumber(phone: string): ServiceResult<{ phone: string }> {
    try {
      const cleanPhone = this.smsTemplates.validatePhoneNumber(phone);
      return {
        success: true,
        data: { phone: cleanPhone }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid phone number',
        statusCode: HttpStatus.BAD_REQUEST
      };
    }
  }

  private validateTemplateData(template: string, data: any): ServiceResult<void> {
    // Check required fields based on template
    const requiredFields: Record<string, string[]> = {
      inspection_started: ['customer_name', 'shop_name', 'vehicle', 'link'],
      inspection_complete: ['customer_name', 'vehicle', 'link'],
      urgent_issue: ['customer_name', 'vehicle', 'shop_phone', 'link'],
      service_reminder: ['customer_name', 'vehicle', 'service', 'link', 'shop_phone'],
      approval_request: ['customer_name', 'shop_name', 'service', 'price', 'link']
    };

    const required = requiredFields[template];
    if (!required) {
      return {
        success: false,
        error: 'Invalid template name',
        statusCode: HttpStatus.BAD_REQUEST
      };
    }

    const missing = required.filter(field => !data[field]);
    if (missing.length > 0) {
      return {
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`,
        statusCode: HttpStatus.BAD_REQUEST
      };
    }

    return { success: true };
  }

  private async sendViaTelnyx(message: any): Promise<{ messageId: string; status: string }> {
    // In a real implementation, this would make an HTTP request to Telnyx API
    // For now, simulate the API call
    
    if (!this.telnyxApiKey) {
      throw new Error('Telnyx API key not configured');
    }

    // Simulate API response
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      messageId: `telnyx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'queued'
    };
  }
}
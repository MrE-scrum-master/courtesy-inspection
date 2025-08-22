/**
 * Unit tests for SMSService
 * Tests SMS sending, templates, cost calculation, and delivery tracking
 */

import { SMSService } from '../../src/services/SMSService';
import { ShortLinkService } from '../../src/services/ShortLinkService';
import { CostService } from '../../src/services/CostService';
import { TestDataFactory } from '../utils/test-setup';

// Mock dependencies
jest.mock('../../src/services/ShortLinkService');
jest.mock('../../src/services/CostService');

const mockShortLinkService = ShortLinkService as jest.Mocked<typeof ShortLinkService>;
const mockCostService = CostService as jest.Mocked<typeof CostService>;

// Mock Telnyx SDK
const mockTelnyx = {
  messages: {
    create: jest.fn()
  }
};

jest.mock('telnyx', () => ({
  __esModule: true,
  default: jest.fn(() => mockTelnyx)
}));

describe('SMSService', () => {
  let smsService: SMSService;
  let mockCustomer: any;
  let mockInspection: any;
  let mockShop: any;

  beforeEach(() => {
    smsService = new SMSService();
    
    mockShop = {
      id: 'shop-123',
      name: 'Test Auto Shop',
      phone: '+1234567890',
      address: '123 Shop Street'
    };

    mockCustomer = TestDataFactory.customer({
      shop_id: mockShop.id,
      phone: '+1987654321'
    });

    mockInspection = TestDataFactory.inspection({
      shop_id: mockShop.id,
      customer_id: mockCustomer.id,
      inspection_number: '24-0042'
    });

    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockShortLinkService.prototype.generateShortLink = jest.fn().mockResolvedValue('https://short.ly/abc123');
    mockCostService.prototype.calculateSMSCost = jest.fn().mockReturnValue(0.02);
    mockTelnyx.messages.create.mockResolvedValue({
      data: {
        id: 'msg_123',
        to: [{ phone_number: mockCustomer.phone }],
        from: '+1234567890',
        text: 'Test message',
        status: 'queued'
      }
    });
  });

  describe('sendInspectionStartedNotification', () => {
    it('should send inspection started notification successfully', async () => {
      // Act
      const result = await smsService.sendInspectionStartedNotification(
        mockCustomer,
        mockInspection,
        mockShop
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_123');
      expect(result.cost).toBe(0.02);
      expect(mockTelnyx.messages.create).toHaveBeenCalledWith({
        from: mockShop.phone,
        to: mockCustomer.phone,
        text: expect.stringContaining('inspection has started'),
        webhook_url: expect.stringContaining('/webhook/telnyx')
      });
    });

    it('should include shop name and inspection number in message', async () => {
      // Act
      await smsService.sendInspectionStartedNotification(
        mockCustomer,
        mockInspection,
        mockShop
      );

      // Assert
      const sentMessage = mockTelnyx.messages.create.mock.calls[0][0];
      expect(sentMessage.text).toContain(mockShop.name);
      expect(sentMessage.text).toContain(mockInspection.inspection_number);
    });

    it('should handle invalid phone numbers', async () => {
      // Arrange
      const invalidCustomer = { ...mockCustomer, phone: 'invalid-phone' };

      // Act
      const result = await smsService.sendInspectionStartedNotification(
        invalidCustomer,
        mockInspection,
        mockShop
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number');
      expect(mockTelnyx.messages.create).not.toHaveBeenCalled();
    });

    it('should handle Telnyx API errors', async () => {
      // Arrange
      mockTelnyx.messages.create.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await smsService.sendInspectionStartedNotification(
        mockCustomer,
        mockInspection,
        mockShop
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to send SMS');
    });
  });

  describe('sendInspectionCompletedNotification', () => {
    it('should send inspection completed notification with report link', async () => {
      // Arrange
      const reportUrl = 'https://app.example.com/reports/inspection-123';

      // Act
      const result = await smsService.sendInspectionCompletedNotification(
        mockCustomer,
        mockInspection,
        mockShop,
        reportUrl
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockShortLinkService.prototype.generateShortLink).toHaveBeenCalledWith(reportUrl);
      
      const sentMessage = mockTelnyx.messages.create.mock.calls[0][0];
      expect(sentMessage.text).toContain('inspection is complete');
      expect(sentMessage.text).toContain('https://short.ly/abc123');
    });

    it('should include urgency information for critical items', async () => {
      // Arrange
      const inspectionWithCriticalItems = {
        ...mockInspection,
        has_critical_issues: true,
        critical_items_count: 2
      };
      const reportUrl = 'https://app.example.com/reports/inspection-123';

      // Act
      const result = await smsService.sendInspectionCompletedNotification(
        mockCustomer,
        inspectionWithCriticalItems,
        mockShop,
        reportUrl
      );

      // Assert
      expect(result.success).toBe(true);
      
      const sentMessage = mockTelnyx.messages.create.mock.calls[0][0];
      expect(sentMessage.text).toContain('URGENT');
      expect(sentMessage.text).toContain('2 critical items');
    });

    it('should use different template for routine vs comprehensive inspections', async () => {
      // Arrange
      const routineInspection = { ...mockInspection, inspection_type: 'routine' };
      const comprehensiveInspection = { ...mockInspection, inspection_type: 'comprehensive' };
      const reportUrl = 'https://app.example.com/reports/inspection-123';

      // Act
      const routineResult = await smsService.sendInspectionCompletedNotification(
        mockCustomer,
        routineInspection,
        mockShop,
        reportUrl
      );
      
      const comprehensiveResult = await smsService.sendInspectionCompletedNotification(
        mockCustomer,
        comprehensiveInspection,
        mockShop,
        reportUrl
      );

      // Assert
      expect(routineResult.success).toBe(true);
      expect(comprehensiveResult.success).toBe(true);
      
      const routineMessage = mockTelnyx.messages.create.mock.calls[0][0];
      const comprehensiveMessage = mockTelnyx.messages.create.mock.calls[1][0];
      
      expect(routineMessage.text).toContain('routine inspection');
      expect(comprehensiveMessage.text).toContain('comprehensive inspection');
    });
  });

  describe('sendFollowUpReminder', () => {
    it('should send follow-up reminder for outstanding items', async () => {
      // Arrange
      const reminderData = {
        days_since_inspection: 7,
        outstanding_items: ['brake_pads', 'oil_change'],
        priority_level: 'high'
      };

      // Act
      const result = await smsService.sendFollowUpReminder(
        mockCustomer,
        mockInspection,
        mockShop,
        reminderData
      );

      // Assert
      expect(result.success).toBe(true);
      
      const sentMessage = mockTelnyx.messages.create.mock.calls[0][0];
      expect(sentMessage.text).toContain('follow-up');
      expect(sentMessage.text).toContain('brake pads');
      expect(sentMessage.text).toContain('oil change');
    });

    it('should adjust tone based on priority level', async () => {
      // Arrange
      const highPriorityReminder = {
        days_since_inspection: 14,
        outstanding_items: ['brake_pads'],
        priority_level: 'critical'
      };
      
      const lowPriorityReminder = {
        days_since_inspection: 30,
        outstanding_items: ['cabin_filter'],
        priority_level: 'low'
      };

      // Act
      const criticalResult = await smsService.sendFollowUpReminder(
        mockCustomer,
        mockInspection,
        mockShop,
        highPriorityReminder
      );
      
      const lowResult = await smsService.sendFollowUpReminder(
        mockCustomer,
        mockInspection,
        mockShop,
        lowPriorityReminder
      );

      // Assert
      expect(criticalResult.success).toBe(true);
      expect(lowResult.success).toBe(true);
      
      const criticalMessage = mockTelnyx.messages.create.mock.calls[0][0];
      const lowMessage = mockTelnyx.messages.create.mock.calls[1][0];
      
      expect(criticalMessage.text).toContain('URGENT');
      expect(lowMessage.text).toContain('reminder');
      expect(lowMessage.text).not.toContain('URGENT');
    });
  });

  describe('sendCustomMessage', () => {
    it('should send custom message with template variables', async () => {
      // Arrange
      const template = 'Hello {customer_name}, your {service_type} is ready for pickup at {shop_name}';
      const variables = {
        customer_name: mockCustomer.first_name,
        service_type: 'vehicle inspection',
        shop_name: mockShop.name
      };

      // Act
      const result = await smsService.sendCustomMessage(
        mockCustomer.phone,
        template,
        variables,
        mockShop.phone
      );

      // Assert
      expect(result.success).toBe(true);
      
      const sentMessage = mockTelnyx.messages.create.mock.calls[0][0];
      expect(sentMessage.text).toContain(mockCustomer.first_name);
      expect(sentMessage.text).toContain('vehicle inspection');
      expect(sentMessage.text).toContain(mockShop.name);
      expect(sentMessage.text).not.toContain('{customer_name}');
    });

    it('should validate message length before sending', async () => {
      // Arrange
      const longMessage = 'A'.repeat(1600); // Exceeds SMS limit
      const variables = {};

      // Act
      const result = await smsService.sendCustomMessage(
        mockCustomer.phone,
        longMessage,
        variables,
        mockShop.phone
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Message too long');
      expect(mockTelnyx.messages.create).not.toHaveBeenCalled();
    });

    it('should handle missing template variables gracefully', async () => {
      // Arrange
      const template = 'Hello {customer_name}, your {missing_variable} is ready';
      const variables = {
        customer_name: mockCustomer.first_name
      };

      // Act
      const result = await smsService.sendCustomMessage(
        mockCustomer.phone,
        template,
        variables,
        mockShop.phone
      );

      // Assert
      expect(result.success).toBe(true);
      
      const sentMessage = mockTelnyx.messages.create.mock.calls[0][0];
      expect(sentMessage.text).toContain(mockCustomer.first_name);
      expect(sentMessage.text).toContain('[missing_variable]'); // Fallback placeholder
    });
  });

  describe('calculateMessageCost', () => {
    it('should calculate cost based on message segments', () => {
      // Arrange
      const shortMessage = 'Short message'; // 1 segment
      const longMessage = 'A'.repeat(200); // 2 segments

      // Act
      const shortCost = smsService.calculateMessageCost(shortMessage);
      const longCost = smsService.calculateMessageCost(longMessage);

      // Assert
      expect(shortCost.segments).toBe(1);
      expect(longCost.segments).toBe(2);
      expect(longCost.total_cost).toBeGreaterThan(shortCost.total_cost);
    });

    it('should account for unicode characters', () => {
      // Arrange
      const unicodeMessage = '¡Hola! Your inspección is complete 🚗';

      // Act
      const cost = smsService.calculateMessageCost(unicodeMessage);

      // Assert
      expect(cost.has_unicode).toBe(true);
      expect(cost.character_limit).toBe(70); // Unicode limit
      expect(cost.total_cost).toBeGreaterThan(0);
    });

    it('should apply bulk pricing for multiple messages', () => {
      // Arrange
      const message = 'Test message';
      const quantity = 100;

      // Act
      const cost = smsService.calculateMessageCost(message, quantity);

      // Assert
      expect(cost.quantity).toBe(quantity);
      expect(cost.bulk_discount).toBeGreaterThan(0);
      expect(cost.total_cost).toBeLessThan(quantity * 0.02); // Should be discounted
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format US phone numbers correctly', () => {
      const testNumbers = [
        { input: '1234567890', expected: '+11234567890' },
        { input: '+1234567890', expected: '+11234567890' },
        { input: '(123) 456-7890', expected: '+11234567890' },
        { input: '123-456-7890', expected: '+11234567890' }
      ];

      testNumbers.forEach(({ input, expected }) => {
        const formatted = smsService.formatPhoneNumber(input);
        expect(formatted).toBe(expected);
      });
    });

    it('should validate phone number format', () => {
      const invalidNumbers = [
        '123',
        'invalid',
        '123-456-789', // Too short
        '123-456-78901' // Too long
      ];

      invalidNumbers.forEach(number => {
        expect(() => smsService.formatPhoneNumber(number)).toThrow('Invalid phone number');
      });
    });

    it('should handle international numbers', () => {
      const internationalNumbers = [
        { input: '+447911123456', expected: '+447911123456' }, // UK
        { input: '+33123456789', expected: '+33123456789' }, // France
        { input: '+49123456789', expected: '+49123456789' } // Germany
      ];

      internationalNumbers.forEach(({ input, expected }) => {
        const formatted = smsService.formatPhoneNumber(input);
        expect(formatted).toBe(expected);
      });
    });
  });

  describe('message templates', () => {
    it('should render inspection started template correctly', () => {
      // Arrange
      const templateData = {
        customer_name: 'John Doe',
        shop_name: 'Test Auto Shop',
        inspection_number: '24-0042',
        technician_name: 'Mike Smith'
      };

      // Act
      const message = smsService.renderTemplate('inspection_started', templateData);

      // Assert
      expect(message).toContain('John Doe');
      expect(message).toContain('Test Auto Shop');
      expect(message).toContain('24-0042');
      expect(message).toContain('Mike Smith');
    });

    it('should render inspection completed template with conditional urgency', () => {
      // Arrange
      const normalTemplateData = {
        customer_name: 'John Doe',
        shop_name: 'Test Auto Shop',
        inspection_number: '24-0042',
        report_link: 'https://short.ly/abc123',
        has_critical_issues: false
      };

      const urgentTemplateData = {
        ...normalTemplateData,
        has_critical_issues: true,
        critical_items_count: 2
      };

      // Act
      const normalMessage = smsService.renderTemplate('inspection_completed', normalTemplateData);
      const urgentMessage = smsService.renderTemplate('inspection_completed', urgentTemplateData);

      // Assert
      expect(normalMessage).not.toContain('URGENT');
      expect(urgentMessage).toContain('URGENT');
      expect(urgentMessage).toContain('2 critical');
    });

    it('should handle missing template gracefully', () => {
      // Arrange
      const templateData = { customer_name: 'John Doe' };

      // Act & Assert
      expect(() => {
        smsService.renderTemplate('nonexistent_template', templateData);
      }).toThrow('Template not found');
    });
  });

  describe('delivery tracking', () => {
    it('should track message delivery status', async () => {
      // Arrange
      const messageId = 'msg_123';
      const deliveryStatus = {
        id: messageId,
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        error_code: null
      };

      // Act
      const result = await smsService.updateDeliveryStatus(messageId, deliveryStatus);

      // Assert
      expect(result.success).toBe(true);
      expect(result.status).toBe('delivered');
    });

    it('should handle delivery failures', async () => {
      // Arrange
      const messageId = 'msg_456';
      const failureStatus = {
        id: messageId,
        status: 'failed',
        delivered_at: null,
        error_code: 'INVALID_DESTINATION'
      };

      // Act
      const result = await smsService.updateDeliveryStatus(messageId, failureStatus);

      // Assert
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error_code).toBe('INVALID_DESTINATION');
    });

    it('should calculate delivery metrics', async () => {
      // Arrange
      const shopId = mockShop.id;
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      // Act
      const metrics = await smsService.getDeliveryMetrics(shopId, dateRange);

      // Assert
      expect(metrics.total_sent).toBeDefined();
      expect(metrics.delivery_rate).toBeDefined();
      expect(metrics.failure_rate).toBeDefined();
      expect(metrics.average_delivery_time).toBeDefined();
      expect(metrics.cost_breakdown).toBeDefined();
    });
  });

  describe('rate limiting and throttling', () => {
    it('should respect rate limits for high volume sending', async () => {
      // Arrange
      const messages = Array(100).fill().map((_, i) => ({
        to: `+123456789${i.toString().padStart(2, '0')}`,
        text: `Test message ${i}`
      }));

      // Act
      const results = await smsService.sendBulkMessages(messages, mockShop.phone);

      // Assert
      expect(results.success).toBe(true);
      expect(results.sent_count).toBeLessThanOrEqual(50); // Rate limit applied
      expect(results.queued_count).toBeGreaterThan(0);
    });

    it('should implement exponential backoff for API errors', async () => {
      // Arrange
      mockTelnyx.messages.create
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({
          data: { id: 'msg_retry', status: 'queued' }
        });

      // Act
      const result = await smsService.sendInspectionStartedNotification(
        mockCustomer,
        mockInspection,
        mockShop
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_retry');
      expect(result.retry_count).toBe(2);
    });
  });
});
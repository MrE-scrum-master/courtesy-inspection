import { Pool } from 'pg';
import { SMSService } from '../src/services/SMSService';
import { ShortLinkService } from '../src/services/ShortLinkService';

// Mock the database pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
} as unknown as Pool;

// Mock Telnyx configuration
jest.mock('../src/config/telnyx.config', () => ({
  telnyxConfig: {
    apiKey: 'test-api-key',
    apiBaseUrl: 'https://api.telnyx.com/v2',
    defaultFromNumber: '+1234567890',
    webhookSigningSecret: 'test-secret',
    maxRetries: 3,
    retryDelay: 1000,
    rateLimitPerSecond: 10,
    costPerSMS: 5,
    messageTimeout: 30000,
  },
  validateTelnyxConfig: jest.fn(),
  smsRateLimiter: {
    canSend: jest.fn(() => true),
    recordSend: jest.fn(),
    getDelay: jest.fn(() => 0),
  },
}));

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
}));

describe('SMSService', () => {
  let smsService: SMSService;
  let shortLinkService: ShortLinkService;

  beforeEach(() => {
    jest.clearAllMocks();
    smsService = new SMSService(mockPool);
    shortLinkService = new ShortLinkService(mockPool);
  });

  describe('validatePhoneNumber', () => {
    it('should validate US phone numbers correctly', () => {
      const tests = [
        { input: '1234567890', expected: { isValid: true, formattedNumber: '+11234567890' } },
        { input: '+11234567890', expected: { isValid: true, formattedNumber: '+11234567890' } },
        { input: '(123) 456-7890', expected: { isValid: true, formattedNumber: '+11234567890' } },
        { input: '123-456-7890', expected: { isValid: true, formattedNumber: '+11234567890' } },
        { input: '123.456.7890', expected: { isValid: true, formattedNumber: '+11234567890' } },
        { input: '123 456 7890', expected: { isValid: true, formattedNumber: '+11234567890' } },
        { input: '123', expected: { isValid: false, formattedNumber: '123' } },
        { input: '12345678901234567890', expected: { isValid: false, formattedNumber: '12345678901234567890' } },
      ];

      tests.forEach(({ input, expected }) => {
        const result = smsService.validatePhoneNumber(input);
        expect(result.isValid).toBe(expected.isValid);
        if (expected.isValid) {
          expect(result.formattedNumber).toBe(expected.formattedNumber);
        }
      });
    });

    it('should handle international phone numbers', () => {
      const result = smsService.validatePhoneNumber('+447911123456'); // UK number
      expect(result.isValid).toBe(true);
      expect(result.formattedNumber).toBe('+447911123456');
    });
  });

  describe('calculateCost', () => {
    it('should calculate SMS cost correctly', () => {
      const tests = [
        { phoneNumber: '+11234567890', message: 'Short message', expectedCost: 5 }, // 1 segment, US
        { phoneNumber: '+11234567890', message: 'A'.repeat(160), expectedCost: 5 }, // 1 segment, US
        { phoneNumber: '+11234567890', message: 'A'.repeat(161), expectedCost: 10 }, // 2 segments, US
        { phoneNumber: '+447911123456', message: 'Short message', expectedCost: 13 }, // 1 segment, international (2.5x)
      ];

      tests.forEach(({ phoneNumber, message, expectedCost }) => {
        const cost = smsService.calculateCost(phoneNumber, message);
        expect(cost).toBe(expectedCost);
      });
    });
  });

  describe('renderTemplate', () => {
    it('should render SMS templates correctly', () => {
      const mockTemplate = {
        key: 'inspection_ready',
        type: 'sms' as const,
        content: 'Hi {{customer_name}}, your {{vehicle}} inspection is complete. View results: {{link}}',
        variables: ['customer_name', 'vehicle', 'link'],
      };

      // Mock the getTemplate method
      jest.spyOn(smsService as any, 'getTemplate').mockReturnValue(mockTemplate);

      const variables = {
        customer_name: 'John Doe',
        vehicle: '2020 Toyota Camry',
        link: 'https://example.com/report/123',
      };

      const result = smsService.renderTemplate('inspection_ready', variables);
      
      expect(result).toBe('Hi John Doe, your 2020 Toyota Camry inspection is complete. View results: https://example.com/report/123');
    });

    it('should handle missing template', () => {
      jest.spyOn(smsService as any, 'getTemplate').mockReturnValue(null);
      
      const result = smsService.renderTemplate('nonexistent_template', {});
      expect(result).toBeNull();
    });
  });
});

describe('ShortLinkService', () => {
  let shortLinkService: ShortLinkService;

  beforeEach(() => {
    jest.clearAllMocks();
    shortLinkService = new ShortLinkService(mockPool);
  });

  describe('isValidUrl', () => {
    it('should validate URLs correctly', () => {
      const tests = [
        { url: 'https://example.com', expected: true },
        { url: 'http://example.com', expected: true },
        { url: 'https://example.com/path?query=value', expected: true },
        { url: 'ftp://example.com', expected: false },
        { url: 'not-a-url', expected: false },
        { url: '', expected: false },
      ];

      tests.forEach(({ url, expected }) => {
        const result = (shortLinkService as any).isValidUrl(url);
        expect(result).toBe(expected);
      });
    });
  });

  describe('isValidShortCode', () => {
    it('should validate short codes correctly', () => {
      const tests = [
        { code: 'abc', expected: true },
        { code: 'ABC123', expected: true },
        { code: '123456789', expected: true },
        { code: 'ab', expected: false }, // Too short
        { code: '12345678901', expected: false }, // Too long
        { code: 'abc-def', expected: false }, // Contains hyphen
        { code: 'abc_def', expected: false }, // Contains underscore
        { code: 'abc def', expected: false }, // Contains space
      ];

      tests.forEach(({ code, expected }) => {
        const result = (shortLinkService as any).isValidShortCode(code);
        expect(result).toBe(expected);
      });
    });
  });

  describe('generateRandomCode', () => {
    it('should generate codes of correct length', () => {
      const lengths = [3, 6, 8, 10];
      
      lengths.forEach(length => {
        const code = (shortLinkService as any).generateRandomCode(length);
        expect(code).toHaveLength(length);
        expect(/^[a-zA-Z0-9]+$/.test(code)).toBe(true);
      });
    });

    it('should respect prefix parameter', () => {
      const prefix = 'test';
      const totalLength = 8;
      const code = (shortLinkService as any).generateRandomCode(totalLength, prefix);
      
      expect(code).toHaveLength(totalLength);
      expect(code.startsWith(prefix)).toBe(true);
      expect(/^[a-zA-Z0-9]+$/.test(code)).toBe(true);
    });
  });

  describe('getFullShortUrl', () => {
    it('should generate correct full URLs', () => {
      const shortCode = 'abc123';
      const expectedUrl = 'https://app.courtesyinspection.com/s/abc123';
      
      const fullUrl = shortLinkService.getFullShortUrl(shortCode);
      expect(fullUrl).toBe(expectedUrl);
    });
  });
});

describe('Integration Tests', () => {
  let smsService: SMSService;
  let shortLinkService: ShortLinkService;

  beforeEach(() => {
    jest.clearAllMocks();
    smsService = new SMSService(mockPool);
    shortLinkService = new ShortLinkService(mockPool);
  });

  describe('SMS with Short Links', () => {
    it('should create inspection ready SMS with short link', async () => {
      // Mock database responses
      const mockShortLink = {
        id: 1,
        short_code: 'abc123',
        long_url: 'https://app.courtesyinspection.com/inspection/456',
        created_at: new Date(),
        expires_at: null,
        click_count: 0,
        is_active: true,
      };

      const mockSMSMessage = {
        id: 1,
        to_phone: '+11234567890',
        from_phone: '+19876543210',
        message_text: 'Hi John Doe, your 2020 Toyota Camry inspection is complete. View results: https://app.courtesyinspection.com/s/abc123',
        message_type: 'outbound',
        status: 'pending',
        shop_id: 1,
        customer_id: 123,
        inspection_id: 456,
        cost_cents: 5,
        sent_at: new Date(),
      };

      // Mock repository calls
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ template_text: 'Hi {{customer_name}}, your {{vehicle}} inspection is complete. View results: {{short_link}}', variables: ['customer_name', 'vehicle', 'short_link'] }] }) // getTemplate
        .mockResolvedValueOnce({ rows: [mockShortLink] }) // createShortLink
        .mockResolvedValueOnce({ rows: [mockSMSMessage] }); // createMessage

      // Mock axios response
      const mockAxiosResponse = {
        data: {
          data: {
            id: 'telnyx-msg-123',
            record_type: 'message',
            direction: 'outbound',
            to: [{ phone_number: '+11234567890', status: 'sent' }],
            from: { phone_number: '+19876543210' },
            text: mockSMSMessage.message_text,
            sent_at: new Date().toISOString(),
          },
        },
      };

      // Mock HTTP client
      const mockHttpClient = {
        post: jest.fn().mockResolvedValue(mockAxiosResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };

      (smsService as any).httpClient = mockHttpClient;

      // Test the integration
      const shortLink = await shortLinkService.createShortLink({
        longUrl: 'https://app.courtesyinspection.com/inspection/456',
        expiryDays: 30,
      });

      const variables = {
        customer_name: 'John Doe',
        vehicle: '2020 Toyota Camry',
        short_link: shortLinkService.getFullShortUrl(shortLink.short_code),
      };

      const smsMessage = await smsService.sendTemplatedSMS('inspection_ready', variables, {
        to: '+11234567890',
        customerId: 123,
        inspectionId: 456,
        shopId: 1,
      });

      expect(smsMessage.message_text).toContain('John Doe');
      expect(smsMessage.message_text).toContain('2020 Toyota Camry');
      expect(smsMessage.message_text).toContain('https://app.courtesyinspection.com/s/abc123');
      expect(smsMessage.cost_cents).toBe(5);
    });
  });
});

// Helper function to create mock database responses
function createMockQueryResponse(rows: any[] = []): { rows: any[] } {
  return { rows };
}

// Export for use in other test files
export { createMockQueryResponse };
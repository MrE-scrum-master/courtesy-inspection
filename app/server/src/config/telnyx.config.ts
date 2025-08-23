import { config } from 'dotenv';

config();

export interface TelnyxConfig {
  apiKey: string;
  apiBaseUrl: string;
  webhookSigningSecret: string;
  defaultFromNumber: string;
  maxRetries: number;
  retryDelay: number;
  rateLimitPerSecond: number;
  costPerSMS: number; // in cents
  messageTimeout: number;
}

export const telnyxConfig: TelnyxConfig = {
  apiKey: process.env.TELNYX_API_KEY || '',
  apiBaseUrl: process.env.TELNYX_API_BASE_URL || 'https://api.telnyx.com/v2',
  webhookSigningSecret: process.env.TELNYX_WEBHOOK_SECRET || '',
  defaultFromNumber: process.env.TELNYX_FROM_NUMBER || '',
  maxRetries: parseInt(process.env.TELNYX_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.TELNYX_RETRY_DELAY || '1000'),
  rateLimitPerSecond: parseInt(process.env.TELNYX_RATE_LIMIT || '10'),
  costPerSMS: parseInt(process.env.SMS_COST_CENTS || '5'), // 5 cents default
  messageTimeout: parseInt(process.env.SMS_TIMEOUT_MS || '30000'),
};

export interface TelnyxMessage {
  to: string;
  from: string;
  text: string;
  messaging_profile_id?: string;
  webhook_url?: string;
  webhook_failover_url?: string;
  use_profile_webhooks?: boolean;
  subject?: string;
  type?: 'SMS' | 'MMS';
}

export interface TelnyxResponse {
  data: {
    id: string;
    record_type: string;
    direction: string;
    to: Array<{
      phone_number: string;
      carrier: string;
      line_type: string;
    }>;
    from: {
      phone_number: string;
      carrier: string;
    };
    text: string;
    subject?: string;
    media?: Array<{
      content_type: string;
      url: string;
    }>;
    messaging_profile_id: string;
    parts: number;
    tags: string[];
    cost?: {
      amount: string;
      currency: string;
    };
    sent_at: string;
    completed_at?: string;
    valid_until: string;
    encoding: string;
    type: string;
  };
}

export interface TelnyxWebhook {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: {
      id: string;
      record_type: string;
      direction: string;
      to: Array<{
        phone_number: string;
        status: string;
        carrier: string;
        line_type: string;
      }>;
      from: {
        phone_number: string;
        carrier: string;
        line_type: string;
      };
      text: string;
      media?: Array<{
        content_type: string;
        url: string;
        size?: number;
      }>;
      messaging_profile_id: string;
      parts: number;
      tags: string[];
      cost?: {
        amount: string;
        currency: string;
      };
      sent_at?: string;
      completed_at?: string;
      received_at?: string;
      webhook_url?: string;
      encoding: string;
      errors?: Array<{
        code: string;
        title: string;
        detail: string;
      }>;
    };
  };
  meta?: {
    attempt: number;
    delivered_to: string;
  };
}

export const TELNYX_EVENT_TYPES = {
  MESSAGE_SENT: 'message.sent',
  MESSAGE_DELIVERED: 'message.delivered',
  MESSAGE_FAILED: 'message.send_failed',
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_FINALIZED: 'message.finalized',
} as const;

export const SMS_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RECEIVED: 'received',
} as const;

export const MESSAGE_DIRECTION = {
  OUTBOUND: 'outbound',
  INBOUND: 'inbound',
} as const;

// Validate required configuration
export function validateTelnyxConfig(): void {
  const required = ['apiKey', 'defaultFromNumber', 'webhookSigningSecret'];
  const missing = required.filter(key => !telnyxConfig[key as keyof TelnyxConfig]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required Telnyx configuration: ${missing.join(', ')}`);
  }
  
  // Validate phone number format
  const phoneRegex = /^\+1\d{10}$/;
  if (!phoneRegex.test(telnyxConfig.defaultFromNumber)) {
    throw new Error('TELNYX_FROM_NUMBER must be in format +1XXXXXXXXXX');
  }
}

// Rate limiting helper
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number = telnyxConfig.rateLimitPerSecond, windowMs: number = 1000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  canSend(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(ts => now - ts < this.windowMs);
    return this.timestamps.length < this.limit;
  }

  recordSend(): void {
    this.timestamps.push(Date.now());
  }

  getDelay(): number {
    if (this.canSend()) return 0;
    const oldest = Math.min(...this.timestamps);
    return Math.max(0, this.windowMs - (Date.now() - oldest));
  }
}

export const smsRateLimiter = new RateLimiter();
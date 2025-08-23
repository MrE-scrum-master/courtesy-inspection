import { Pool } from 'pg';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { ShortLinkRepository, ShortLink, CreateShortLinkData, LinkAnalytics } from '../repositories/ShortLinkRepository';
import { Logger } from '../utils/Logger';

export interface CreateShortLinkOptions {
  longUrl: string;
  customCode?: string;
  expiryDays?: number;
  createdBy?: number;
  metadata?: any;
}

export interface ShortLinkWithQR extends ShortLink {
  qr_code?: string; // Base64 encoded QR code
}

export interface BulkCreateOptions {
  urls: string[];
  expiryDays?: number;
  createdBy?: number;
  prefix?: string;
}

export class ShortLinkService {
  private readonly shortLinkRepository: ShortLinkRepository;
  private readonly logger: Logger;
  private readonly baseUrl: string;
  private readonly defaultExpiryDays: number;

  // Base62 characters for short code generation
  private readonly BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  constructor(pool: Pool, baseUrl?: string) {
    this.shortLinkRepository = new ShortLinkRepository(pool);
    this.logger = new Logger('ShortLinkService');
    this.baseUrl = baseUrl || process.env.SHORT_LINK_BASE_URL || 'https://app.courtesyinspection.com/s/';
    this.defaultExpiryDays = parseInt(process.env.SHORT_LINK_DEFAULT_EXPIRY_DAYS || '30');
  }

  /**
   * Create a short link with optional custom code
   */
  async createShortLink(options: CreateShortLinkOptions): Promise<ShortLink> {
    if (!this.isValidUrl(options.longUrl)) {
      throw new Error('Invalid URL provided');
    }

    let shortCode = options.customCode;
    
    if (shortCode) {
      // Validate custom code
      if (!this.isValidShortCode(shortCode)) {
        throw new Error('Invalid custom code. Must be 3-10 characters, alphanumeric only');
      }
      
      // Check if custom code is available
      const isAvailable = await this.shortLinkRepository.isShortCodeAvailable(shortCode);
      if (!isAvailable) {
        throw new Error('Custom code is already in use');
      }
    } else {
      // Generate random short code
      shortCode = await this.generateUniqueShortCode();
    }

    const expiresAt = options.expiryDays 
      ? new Date(Date.now() + options.expiryDays * 24 * 60 * 60 * 1000)
      : null;

    const createData: CreateShortLinkData = {
      short_code: shortCode,
      long_url: options.longUrl,
      created_by: options.createdBy,
      expires_at: expiresAt,
      metadata: {
        ...options.metadata,
        created_at: new Date().toISOString(),
        user_agent: 'system',
      },
    };

    const shortLink = await this.shortLinkRepository.createShortLink(createData);

    this.logger.info('Short link created', {
      shortCode: shortLink.short_code,
      longUrl: shortLink.long_url,
      expiresAt: shortLink.expires_at,
      createdBy: shortLink.created_by,
    });

    return shortLink;
  }

  /**
   * Resolve short link and track click
   */
  async resolveShortLink(
    shortCode: string,
    ipAddress?: string,
    userAgent?: string,
    referrer?: string
  ): Promise<{ url: string; metadata: any } | null> {
    const shortLink = await this.shortLinkRepository.getShortLinkByCode(shortCode);
    
    if (!shortLink) {
      this.logger.warn('Short link not found or expired', { shortCode });
      return null;
    }

    // Record the click
    await this.trackLinkClick(shortLink.id, ipAddress, userAgent, referrer);

    // Update click count
    await this.shortLinkRepository.updateClickCount(shortCode);

    this.logger.info('Short link resolved', {
      shortCode,
      longUrl: shortLink.long_url,
      clickCount: shortLink.click_count + 1,
    });

    return {
      url: shortLink.long_url,
      metadata: shortLink.metadata,
    };
  }

  /**
   * Track link click with analytics data
   */
  async trackLinkClick(
    shortLinkId: number,
    ipAddress?: string,
    userAgent?: string,
    referrer?: string
  ): Promise<void> {
    await this.shortLinkRepository.recordClick(
      shortLinkId,
      ipAddress || null,
      userAgent || null,
      referrer || null
    );
  }

  /**
   * Expire a short link
   */
  async expireLink(shortCode: string): Promise<boolean> {
    const success = await this.shortLinkRepository.expireShortLink(shortCode);
    
    if (success) {
      this.logger.info('Short link expired', { shortCode });
    } else {
      this.logger.warn('Failed to expire short link', { shortCode });
    }

    return success;
  }

  /**
   * Generate QR code for short link
   */
  async generateQRCode(shortCode: string, options?: QRCode.QRCodeToDataURLOptions): Promise<string> {
    const fullUrl = this.getFullShortUrl(shortCode);
    
    const qrOptions: QRCode.QRCodeToDataURLOptions = {
      type: 'image/png',
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      ...options,
    };

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(fullUrl, qrOptions);
      return qrCodeDataUrl;
    } catch (error) {
      this.logger.error('Failed to generate QR code', { shortCode, error });
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Create multiple short links in batch
   */
  async bulkCreateLinks(options: BulkCreateOptions): Promise<ShortLink[]> {
    if (options.urls.length === 0) {
      return [];
    }

    // Validate all URLs first
    const invalidUrls = options.urls.filter(url => !this.isValidUrl(url));
    if (invalidUrls.length > 0) {
      throw new Error(`Invalid URLs provided: ${invalidUrls.join(', ')}`);
    }

    const expiresAt = options.expiryDays 
      ? new Date(Date.now() + options.expiryDays * 24 * 60 * 60 * 1000)
      : null;

    // Generate unique short codes for all URLs
    const createDataList: CreateShortLinkData[] = [];
    
    for (const url of options.urls) {
      const shortCode = await this.generateUniqueShortCode(options.prefix);
      
      createDataList.push({
        short_code: shortCode,
        long_url: url,
        created_by: options.createdBy,
        expires_at: expiresAt,
        metadata: {
          bulk_created: true,
          created_at: new Date().toISOString(),
        },
      });
    }

    const shortLinks = await this.shortLinkRepository.bulkCreateShortLinks(createDataList);

    this.logger.info('Bulk short links created', {
      count: shortLinks.length,
      expiresAt,
      createdBy: options.createdBy,
    });

    return shortLinks;
  }

  /**
   * Get link analytics
   */
  async getLinkAnalytics(shortCode: string): Promise<LinkAnalytics | null> {
    return this.shortLinkRepository.getLinkAnalytics(shortCode);
  }

  /**
   * Get short link with QR code
   */
  async getShortLinkWithQR(shortCode: string): Promise<ShortLinkWithQR | null> {
    const shortLink = await this.shortLinkRepository.getShortLinkByCode(shortCode);
    
    if (!shortLink) {
      return null;
    }

    try {
      const qrCode = await this.generateQRCode(shortCode);
      return {
        ...shortLink,
        qr_code: qrCode,
      };
    } catch (error) {
      this.logger.error('Failed to generate QR code for short link', { shortCode, error });
      return shortLink;
    }
  }

  /**
   * Clean up expired links
   */
  async cleanupExpiredLinks(): Promise<number> {
    const expiredCount = await this.shortLinkRepository.expireExpiredLinks();
    
    if (expiredCount > 0) {
      this.logger.info('Expired links cleaned up', { count: expiredCount });
    }

    return expiredCount;
  }

  /**
   * Get links expiring soon
   */
  async getExpiringSoon(days: number = 7): Promise<ShortLink[]> {
    return this.shortLinkRepository.getExpiringSoon(days);
  }

  /**
   * Get most popular links
   */
  async getMostPopularLinks(limit: number = 10): Promise<ShortLink[]> {
    return this.shortLinkRepository.getMostPopularLinks(limit);
  }

  /**
   * Update short link
   */
  async updateShortLink(
    shortCode: string,
    updates: { longUrl?: string; expiryDays?: number; metadata?: any }
  ): Promise<ShortLink | null> {
    const updateData: any = {};

    if (updates.longUrl) {
      if (!this.isValidUrl(updates.longUrl)) {
        throw new Error('Invalid URL provided');
      }
      updateData.long_url = updates.longUrl;
    }

    if (updates.expiryDays !== undefined) {
      updateData.expires_at = updates.expiryDays > 0 
        ? new Date(Date.now() + updates.expiryDays * 24 * 60 * 60 * 1000)
        : null;
    }

    if (updates.metadata) {
      updateData.metadata = updates.metadata;
    }

    return this.shortLinkRepository.updateShortLink(shortCode, updateData);
  }

  /**
   * Get full short URL
   */
  getFullShortUrl(shortCode: string): string {
    return `${this.baseUrl}${shortCode}`;
  }

  /**
   * Get recent clicks across all links
   */
  async getRecentClicks(limit: number = 50) {
    return this.shortLinkRepository.getRecentClicks(limit);
  }

  // Private helper methods

  /**
   * Generate a unique short code
   */
  private async generateUniqueShortCode(prefix?: string, length: number = 6): Promise<string> {
    const maxAttempts = 10;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const shortCode = this.generateRandomCode(length, prefix);
      const isAvailable = await this.shortLinkRepository.isShortCodeAvailable(shortCode);
      
      if (isAvailable) {
        return shortCode;
      }
      
      // Increase length on subsequent attempts
      if (attempt > 5) {
        length++;
      }
    }

    throw new Error('Unable to generate unique short code after maximum attempts');
  }

  /**
   * Generate random base62 code
   */
  private generateRandomCode(length: number, prefix?: string): string {
    let result = prefix || '';
    const remainingLength = length - result.length;
    
    if (remainingLength <= 0) {
      return result.substring(0, length);
    }

    for (let i = 0; i < remainingLength; i++) {
      const randomIndex = crypto.randomInt(0, this.BASE62_CHARS.length);
      result += this.BASE62_CHARS[randomIndex];
    }

    return result;
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Validate short code format
   */
  private isValidShortCode(shortCode: string): boolean {
    // 3-10 characters, alphanumeric only
    const regex = /^[a-zA-Z0-9]{3,10}$/;
    return regex.test(shortCode);
  }
}
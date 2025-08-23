/**
 * SMS Templates for Courtesy Inspection
 * Customer notification templates under 160 characters
 * Designed for Telnyx SMS API integration
 */

class SMSTemplates {
  constructor() {
    // Core templates - all under 160 characters
    this.templates = {
      // Inspection started - 123 chars
      inspection_started: {
        template: 'Hi {customer_name}, {shop_name} started inspecting your {vehicle}. Track progress: {link}',
        variables: ['customer_name', 'shop_name', 'vehicle', 'link'],
        maxLength: 160,
        type: 'notification'
      },

      // Inspection complete - 139 chars
      inspection_complete: {
        template: 'Hi {customer_name}, your {vehicle} inspection is complete! View report & recommendations: {link}',
        variables: ['customer_name', 'vehicle', 'link'],
        maxLength: 160,
        type: 'notification'
      },

      // Urgent issue found - 142 chars
      urgent_issue: {
        template: '⚠️ {customer_name}, we found an urgent issue with your {vehicle}. Please call {shop_phone} or view details: {link}',
        variables: ['customer_name', 'vehicle', 'shop_phone', 'link'],
        maxLength: 160,
        type: 'urgent'
      },

      // Service recommendation - 134 chars
      service_reminder: {
        template: '{customer_name}, your {vehicle} needs {service}. Schedule online: {link} or call {shop_phone}',
        variables: ['customer_name', 'vehicle', 'service', 'link', 'shop_phone'],
        maxLength: 160,
        type: 'reminder'
      },

      // Quick approval - 128 chars
      approval_request: {
        template: '{customer_name}, {shop_name} recommends {service} for ${price}. Reply Y to approve or view details: {link}',
        variables: ['customer_name', 'shop_name', 'service', 'price', 'link'],
        maxLength: 160,
        type: 'approval'
      }
    };

    // Short link base URL (will be replaced with actual domain)
    this.linkBase = 'https://ci.link/';
  }

  /**
   * Get a template and fill in variables
   * @param {string} templateName - Name of the template
   * @param {object} data - Data to fill in template variables
   * @returns {object} Formatted message ready for sending
   */
  getMessage(templateName, data) {
    const template = this.templates[templateName];
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    let message = template.template;

    // Replace variables
    for (const variable of template.variables) {
      if (!data[variable]) {
        throw new Error(`Missing required variable: ${variable}`);
      }
      
      // Special handling for links - shorten them
      if (variable === 'link') {
        const shortLink = this.shortenLink(data[variable]);
        message = message.replace(`{${variable}}`, shortLink);
      } else {
        message = message.replace(`{${variable}}`, data[variable]);
      }
    }

    // Validate length
    if (message.length > template.maxLength) {
      throw new Error(`Message exceeds ${template.maxLength} characters (${message.length})`);
    }

    return {
      message,
      length: message.length,
      type: template.type,
      template: templateName
    };
  }

  /**
   * Shorten a link for SMS
   * In production, this would integrate with a URL shortener
   */
  shortenLink(longUrl) {
    // For MVP, use a simple hash
    const hash = this.simpleHash(longUrl);
    return `${this.linkBase}${hash}`;
  }

  /**
   * Simple hash function for URL shortening
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 6);
  }

  /**
   * Format message for Telnyx API
   * @param {string} to - Phone number to send to
   * @param {string} templateName - Template to use
   * @param {object} data - Template variables
   * @returns {object} Formatted payload for Telnyx
   */
  formatForTelnyx(to, templateName, data) {
    const message = this.getMessage(templateName, data);
    
    return {
      from: process.env.TELNYX_PHONE_NUMBER || '+15555555555',
      to: to,
      text: message.message,
      webhook_url: `${process.env.BASE_URL}/api/sms/webhook`,
      use_profile_webhooks: false,
      metadata: {
        template: templateName,
        type: message.type,
        customer_id: data.customer_id,
        inspection_id: data.inspection_id
      }
    };
  }

  /**
   * Batch send multiple messages
   * @param {array} messages - Array of message objects
   * @returns {array} Formatted messages for Telnyx batch API
   */
  formatBatch(messages) {
    return messages.map(msg => 
      this.formatForTelnyx(msg.to, msg.template, msg.data)
    );
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates() {
    return Object.keys(this.templates).map(key => ({
      name: key,
      type: this.templates[key].type,
      variables: this.templates[key].variables,
      maxLength: this.templates[key].maxLength
    }));
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phone) {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');
    
    // Check if it's a valid US number (10 or 11 digits)
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+${cleaned}`;
    }
    
    throw new Error('Invalid phone number format');
  }
}

module.exports = SMSTemplates;
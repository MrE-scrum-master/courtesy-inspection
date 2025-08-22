/**
 * Voice Parser for Courtesy Inspection
 * Converts voice-to-text inspection notes into structured data
 * Handles automotive terminology, measurements, and status indicators
 */

class VoiceParser {
  constructor() {
    // Automotive component vocabulary
    this.components = [
      'brake', 'brakes', 'pad', 'pads', 'rotor', 'rotors',
      'tire', 'tires', 'tread', 'wheel', 'wheels',
      'oil', 'filter', 'engine', 'transmission', 'fluid',
      'battery', 'alternator', 'starter',
      'belt', 'belts', 'hose', 'hoses',
      'wiper', 'wipers', 'blade', 'blades',
      'light', 'lights', 'headlight', 'taillight', 'bulb',
      'air filter', 'cabin filter', 'fuel filter',
      'coolant', 'antifreeze', 'radiator',
      'suspension', 'strut', 'struts', 'shock', 'shocks'
    ];

    // Status indicators
    this.statusWords = {
      good: ['good', 'fine', 'okay', 'ok', 'great', 'excellent', 'new', 'like new'],
      yellow: ['worn', 'wearing', 'marginal', 'fair', 'aging', 'moderate'],
      red: ['bad', 'poor', 'worn out', 'critical', 'urgent', 'failing', 'failed'],
      needs: ['needs', 'need', 'requires', 'require', 'recommend', 'should']
    };

    // Measurement patterns - Enhanced with more variations
    this.measurementPatterns = [
      { regex: /(\d+(?:\.\d+)?)\s*(millimeters?|mm)/i, unit: 'mm' },
      { regex: /(\d+(?:\.\d+)?)\s*(inches?|in|")/i, unit: 'inches' },
      { regex: /(\d+(?:\.\d+)?)\s*(percent|%)/i, unit: 'percent' },
      { regex: /(\d+(?:\.\d+)?)\s*(psi|pounds?)/i, unit: 'psi' },
      { regex: /(\d+)\/(\d+)\s*(of an inch|inch)?/i, unit: 'fraction' },
      { regex: /(\d+(?:\.\d+)?)\s*(thirty-?seconds?)/i, unit: '32nds' }
    ];
  }

  /**
   * Main parsing function
   * @param {string} text - Voice transcription text
   * @returns {object} Parsed inspection data with confidence scores
   */
  parse(text) {
    if (!text || typeof text !== 'string') {
      return { error: 'Invalid input', confidence: 0 };
    }

    const normalized = text.toLowerCase().trim();
    const result = {
      original: text,
      component: this.extractComponent(normalized),
      status: this.extractStatus(normalized),
      measurement: this.extractMeasurement(normalized),
      action: this.extractAction(normalized),
      confidence: 0,
      timestamp: new Date().toISOString()
    };

    // Calculate confidence score
    result.confidence = this.calculateConfidence(result);

    return result;
  }

  /**
   * Extract automotive component from text
   */
  extractComponent(text) {
    for (const component of this.components) {
      if (text.includes(component)) {
        // Add position context (front/rear/left/right)
        const position = this.extractPosition(text, component);
        return position ? `${position} ${component}` : component;
      }
    }
    return null;
  }

  /**
   * Extract position (front/rear/left/right)
   */
  extractPosition(text, component) {
    const positions = ['front', 'rear', 'left', 'right', 'driver', 'passenger'];
    const componentIndex = text.indexOf(component);
    const beforeComponent = text.substring(Math.max(0, componentIndex - 20), componentIndex);
    
    for (const position of positions) {
      if (beforeComponent.includes(position)) {
        return position;
      }
    }
    return null;
  }

  /**
   * Extract status from text
   */
  extractStatus(text) {
    for (const [status, words] of Object.entries(this.statusWords)) {
      for (const word of words) {
        if (text.includes(word)) {
          return status === 'good' ? 'green' : status === 'needs' ? 'attention' : status;
        }
      }
    }
    return null;
  }

  /**
   * Extract measurements from text
   */
  extractMeasurement(text) {
    for (const pattern of this.measurementPatterns) {
      const match = text.match(pattern.regex);
      if (match) {
        if (pattern.unit === 'fraction') {
          // Convert fraction to decimal
          const value = parseFloat(match[1]) / parseFloat(match[2]);
          return { value: value.toFixed(3), unit: 'inches', raw: match[0] };
        }
        return { value: parseFloat(match[1]), unit: pattern.unit, raw: match[0] };
      }
    }
    return null;
  }

  /**
   * Extract recommended action from text
   */
  extractAction(text) {
    const actionPhrases = [
      { phrase: 'needs replacement', action: 'replace' },
      { phrase: 'should be replaced', action: 'replace' },
      { phrase: 'recommend replacement', action: 'replace' },
      { phrase: 'needs to be checked', action: 'inspect' },
      { phrase: 'monitor', action: 'monitor' },
      { phrase: 'top off', action: 'top_off' },
      { phrase: 'rotate', action: 'rotate' }
    ];

    for (const { phrase, action } of actionPhrases) {
      if (text.includes(phrase)) {
        return action;
      }
    }
    return null;
  }

  /**
   * Calculate confidence score based on extracted data
   */
  calculateConfidence(result) {
    let confidence = 0;
    let factors = 0;

    if (result.component) {
      confidence += 0.4;
      factors++;
    }
    if (result.status) {
      confidence += 0.3;
      factors++;
    }
    if (result.measurement) {
      confidence += 0.2;
      factors++;
    }
    if (result.action) {
      confidence += 0.1;
      factors++;
    }

    // Normalize based on factors found
    if (factors > 0) {
      confidence = confidence / (factors * 0.25);
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Batch parse multiple voice inputs
   */
  parseBatch(texts) {
    if (!Array.isArray(texts)) {
      return { error: 'Input must be an array' };
    }
    return texts.map(text => this.parse(text));
  }
}

module.exports = VoiceParser;
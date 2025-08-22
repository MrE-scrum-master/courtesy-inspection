// Voice Service - Business logic for voice processing and parsing
// Integrates voice-parser.js template with service layer validation

import { VoiceInputDTO, VoiceParsingResponseDTO } from '../types/dtos';
import { ServiceResult, AppError, HttpStatus } from '../types/common';
import { VoiceParsingResult } from '../types/entities';

// Import the voice parser from templates
const VoiceParser = require('../../../../templates/voice-parser');

export class VoiceService {
  private voiceParser: any;

  constructor() {
    this.voiceParser = new VoiceParser();
  }

  // Parse voice input with enhanced validation and suggestions
  async parseVoiceInput(data: VoiceInputDTO): Promise<ServiceResult<VoiceParsingResponseDTO>> {
    try {
      // Basic validation
      if (!data.text || data.text.trim().length === 0) {
        return {
          success: false,
          error: 'Voice text is required',
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      if (data.text.length > 2000) {
        return {
          success: false,
          error: 'Voice text too long (max 2000 characters)',
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      // Parse voice input using the template parser
      const parseResult = this.voiceParser.parse(data.text);

      // Validate parsing result
      if (parseResult.error) {
        return {
          success: false,
          error: parseResult.error,
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      // Generate suggestions based on parsing confidence
      const suggestions = this.generateSuggestions(parseResult);

      // Enhance result with additional context
      const enhancedResult: VoiceParsingResponseDTO = {
        original: parseResult.original,
        component: parseResult.component,
        status: parseResult.status,
        measurement: parseResult.measurement,
        action: parseResult.action,
        confidence: parseResult.confidence,
        timestamp: parseResult.timestamp,
        suggestions
      };

      return {
        success: true,
        data: enhancedResult
      };

    } catch (error) {
      console.error('Voice parsing error:', error);
      return {
        success: false,
        error: 'Voice parsing failed',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Parse multiple voice inputs in batch
  async parseBatchVoiceInput(texts: string[]): Promise<ServiceResult<VoiceParsingResponseDTO[]>> {
    try {
      if (!Array.isArray(texts) || texts.length === 0) {
        return {
          success: false,
          error: 'Text array is required',
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      if (texts.length > 50) {
        return {
          success: false,
          error: 'Batch size too large (max 50 items)',
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      // Parse each text
      const results: VoiceParsingResponseDTO[] = [];
      
      for (const text of texts) {
        if (text && text.trim().length > 0) {
          const parseResult = this.voiceParser.parse(text);
          
          if (!parseResult.error) {
            results.push({
              original: parseResult.original,
              component: parseResult.component,
              status: parseResult.status,
              measurement: parseResult.measurement,
              action: parseResult.action,
              confidence: parseResult.confidence,
              timestamp: parseResult.timestamp,
              suggestions: this.generateSuggestions(parseResult)
            });
          }
        }
      }

      return {
        success: true,
        data: results
      };

    } catch (error) {
      console.error('Batch voice parsing error:', error);
      return {
        success: false,
        error: 'Batch voice parsing failed',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Get available components for voice recognition
  async getAvailableComponents(): Promise<ServiceResult<string[]>> {
    try {
      // Get components from the voice parser
      const components = this.voiceParser.components || [];

      return {
        success: true,
        data: components
      };

    } catch (error) {
      console.error('Get components error:', error);
      return {
        success: false,
        error: 'Failed to retrieve components',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Get status mapping for voice recognition
  async getStatusMapping(): Promise<ServiceResult<Record<string, string[]>>> {
    try {
      // Get status words from the voice parser
      const statusWords = this.voiceParser.statusWords || {};

      return {
        success: true,
        data: statusWords
      };

    } catch (error) {
      console.error('Get status mapping error:', error);
      return {
        success: false,
        error: 'Failed to retrieve status mapping',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Validate voice input quality
  async validateVoiceQuality(text: string): Promise<ServiceResult<{ quality: string; score: number; issues: string[] }>> {
    try {
      const issues: string[] = [];
      let score = 100;

      // Check length
      if (text.length < 5) {
        issues.push('Text too short for reliable parsing');
        score -= 30;
      }

      // Check for common transcription issues
      if (text.includes('?') || text.includes('[inaudible]') || text.includes('...')) {
        issues.push('Transcription contains unclear sections');
        score -= 20;
      }

      // Check for numbers/measurements
      const hasNumbers = /\d/.test(text);
      if (!hasNumbers) {
        issues.push('No measurements detected - consider adding specific values');
        score -= 10;
      }

      // Check for automotive terms
      const hasAutomotiveTerms = this.voiceParser.components.some((comp: string) => 
        text.toLowerCase().includes(comp)
      );
      
      if (!hasAutomotiveTerms) {
        issues.push('No automotive components detected');
        score -= 15;
      }

      // Determine quality level
      let quality = 'excellent';
      if (score < 90) quality = 'good';
      if (score < 70) quality = 'fair';
      if (score < 50) quality = 'poor';

      return {
        success: true,
        data: {
          quality,
          score: Math.max(0, score),
          issues
        }
      };

    } catch (error) {
      console.error('Voice quality validation error:', error);
      return {
        success: false,
        error: 'Voice quality validation failed',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Get voice parsing statistics for shop
  async getParsingStatistics(shopId: string, days: number = 30): Promise<ServiceResult<any>> {
    try {
      // This would typically query the database for parsing statistics
      // For MVP, return mock statistics
      const stats = {
        total_voice_inputs: 0,
        average_confidence: 0,
        most_common_components: [],
        parsing_accuracy: 0,
        period_days: days
      };

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      console.error('Get parsing statistics error:', error);
      return {
        success: false,
        error: 'Failed to retrieve parsing statistics',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Private helper methods
  private generateSuggestions(parseResult: VoiceParsingResult): string[] {
    const suggestions: string[] = [];

    // Low confidence suggestions
    if (parseResult.confidence < 0.7) {
      suggestions.push('Consider being more specific about the component and its condition');
      
      if (!parseResult.component) {
        suggestions.push('Try including specific automotive parts (brakes, tires, oil, etc.)');
      }
      
      if (!parseResult.status) {
        suggestions.push('Include condition words like "good", "worn", or "needs replacement"');
      }
      
      if (!parseResult.measurement) {
        suggestions.push('Add specific measurements (thickness, pressure, etc.)');
      }
    }

    // Missing component suggestions
    if (!parseResult.component && parseResult.confidence > 0.3) {
      suggestions.push('Voice input processed, but no automotive component detected');
    }

    // Measurement format suggestions
    if (parseResult.measurement && parseResult.measurement.unit === 'fraction') {
      suggestions.push('Fraction measurements converted to decimal format');
    }

    // High confidence acknowledgment
    if (parseResult.confidence >= 0.8) {
      suggestions.push('High confidence parsing - input looks good!');
    }

    // Action recommendations
    if (parseResult.action) {
      suggestions.push(`Recommended action: ${parseResult.action}`);
    }

    return suggestions;
  }

  // Convert status to traffic light system
  private mapStatusToTrafficLight(status: string | null): 'green' | 'yellow' | 'red' | null {
    if (!status) return null;

    const statusMap: Record<string, 'green' | 'yellow' | 'red'> = {
      'green': 'green',
      'good': 'green',
      'yellow': 'yellow',
      'worn': 'yellow',
      'marginal': 'yellow',
      'red': 'red',
      'bad': 'red',
      'critical': 'red',
      'attention': 'yellow'
    };

    return statusMap[status] || null;
  }

  // Extract priority level from parsing result
  private extractPriority(parseResult: VoiceParsingResult): 'low' | 'medium' | 'high' {
    // Red status = high priority
    if (parseResult.status === 'red' || parseResult.status === 'critical') {
      return 'high';
    }

    // Yellow status = medium priority
    if (parseResult.status === 'yellow' || parseResult.status === 'worn') {
      return 'medium';
    }

    // Green status or no status = low priority
    return 'low';
  }
}
/**
 * Unit tests for VoiceProcessingService
 * Tests voice input parsing, natural language processing, and accuracy
 */

import { VoiceProcessingService } from '../../src/services/VoiceProcessingService';
import { TestDataFactory } from '../utils/test-setup';

describe('VoiceProcessingService', () => {
  let voiceProcessingService: VoiceProcessingService;

  beforeEach(() => {
    voiceProcessingService = new VoiceProcessingService();
    jest.clearAllMocks();
  });

  describe('processVoiceInput', () => {
    it('should parse brake inspection voice input correctly', async () => {
      // Arrange
      const voiceInput = "The brake pads are worn and need replacement, they're down to about 20% thickness";

      // Act
      const result = await voiceProcessingService.processVoiceInput(voiceInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.parsed.category).toBe('brakes');
      expect(result.parsed.item).toBe('brake_pads');
      expect(result.parsed.status).toBe('needs_service');
      expect(result.parsed.urgency_level).toBe('high');
      expect(result.parsed.notes).toContain('worn');
      expect(result.parsed.notes).toContain('20%');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should parse engine inspection voice input correctly', async () => {
      // Arrange
      const voiceInput = "Oil filter looks good, clean and recently replaced, no issues found";

      // Act
      const result = await voiceProcessingService.processVoiceInput(voiceInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.parsed.category).toBe('engine');
      expect(result.parsed.item).toBe('oil_filter');
      expect(result.parsed.status).toBe('good');
      expect(result.parsed.urgency_level).toBe('low');
      expect(result.parsed.notes).toContain('clean');
      expect(result.parsed.notes).toContain('recently replaced');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should parse tire inspection voice input correctly', async () => {
      // Arrange
      const voiceInput = "Front left tire tread depth is at 3/32 inches, approaching minimum, recommend replacement soon";

      // Act
      const result = await voiceProcessingService.processVoiceInput(voiceInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.parsed.category).toBe('tires');
      expect(result.parsed.item).toBe('tire_tread');
      expect(result.parsed.status).toBe('needs_attention');
      expect(result.parsed.urgency_level).toBe('medium');
      expect(result.parsed.notes).toContain('3/32');
      expect(result.parsed.notes).toContain('front left');
      expect(result.parsed.position).toBe('front_left');
    });

    it('should handle ambiguous voice input with lower confidence', async () => {
      // Arrange
      const voiceInput = "Something seems off but I'm not sure what exactly";

      // Act
      const result = await voiceProcessingService.processVoiceInput(voiceInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.parsed.category).toBe('general');
      expect(result.parsed.status).toBe('needs_inspection');
      expect(result.confidence).toBeLessThan(0.6);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should extract measurements and technical details', async () => {
      // Arrange
      const voiceInput = "Battery voltage reads 11.8 volts, below the 12.4 volt minimum, needs replacement";

      // Act
      const result = await voiceProcessingService.processVoiceInput(voiceInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.parsed.category).toBe('electrical');
      expect(result.parsed.item).toBe('battery');
      expect(result.parsed.status).toBe('needs_service');
      expect(result.parsed.measurements).toBeDefined();
      expect(result.parsed.measurements.voltage).toBe(11.8);
      expect(result.parsed.measurements.minimum_threshold).toBe(12.4);
      expect(result.parsed.urgency_level).toBe('high');
    });

    it('should handle multiple items in single voice input', async () => {
      // Arrange
      const voiceInput = "Checked brakes and tires, brake pads are good but front tires need rotation";

      // Act
      const result = await voiceProcessingService.processVoiceInput(voiceInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.multiple_items).toBe(true);
      expect(result.parsed_items).toHaveLength(2);
      
      const brakeItem = result.parsed_items.find(item => item.category === 'brakes');
      const tireItem = result.parsed_items.find(item => item.category === 'tires');
      
      expect(brakeItem.status).toBe('good');
      expect(tireItem.status).toBe('needs_service');
      expect(tireItem.recommendation).toBe('rotation');
    });

    it('should recognize urgency keywords correctly', async () => {
      // Arrange
      const urgentInput = "URGENT: brake line is leaking brake fluid, immediate safety concern";
      const routineInput = "Routine check, everything looks normal, good condition";

      // Act
      const urgentResult = await voiceProcessingService.processVoiceInput(urgentInput);
      const routineResult = await voiceProcessingService.processVoiceInput(routineInput);

      // Assert
      expect(urgentResult.parsed.urgency_level).toBe('critical');
      expect(urgentResult.parsed.safety_concern).toBe(true);
      expect(routineResult.parsed.urgency_level).toBe('low');
      expect(routineResult.parsed.safety_concern).toBe(false);
    });

    it('should handle noise and filler words', async () => {
      // Arrange
      const noisyInput = "Um, let me see, the uh, the brake pads, you know, they look um worn out";

      // Act
      const result = await voiceProcessingService.processVoiceInput(noisyInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.parsed.category).toBe('brakes');
      expect(result.parsed.item).toBe('brake_pads');
      expect(result.parsed.status).toBe('worn');
      expect(result.parsed.notes).not.toContain('um');
      expect(result.parsed.notes).not.toContain('uh');
    });

    it('should provide spelling corrections for technical terms', async () => {
      // Arrange
      const misspelledInput = "The alternatir is making noise and the sparkplugs need replacement";

      // Act
      const result = await voiceProcessingService.processVoiceInput(misspelledInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.spelling_corrections).toBeDefined();
      expect(result.spelling_corrections).toContain('alternator');
      expect(result.spelling_corrections).toContain('spark plugs');
      expect(result.multiple_items).toBe(true);
    });
  });

  describe('extractCategory', () => {
    it('should correctly identify brake-related keywords', () => {
      const brakeKeywords = [
        'brake pads',
        'brake disc',
        'brake fluid',
        'brake line',
        'braking system',
        'brake rotor'
      ];

      brakeKeywords.forEach(keyword => {
        const category = voiceProcessingService.extractCategory(keyword);
        expect(category).toBe('brakes');
      });
    });

    it('should correctly identify engine-related keywords', () => {
      const engineKeywords = [
        'oil filter',
        'air filter',
        'spark plugs',
        'engine oil',
        'coolant',
        'belt'
      ];

      engineKeywords.forEach(keyword => {
        const category = voiceProcessingService.extractCategory(keyword);
        expect(category).toBe('engine');
      });
    });

    it('should correctly identify electrical-related keywords', () => {
      const electricalKeywords = [
        'battery',
        'alternator',
        'starter',
        'fuse',
        'wiring',
        'headlight'
      ];

      electricalKeywords.forEach(keyword => {
        const category = voiceProcessingService.extractCategory(keyword);
        expect(category).toBe('electrical');
      });
    });

    it('should handle compound categories', () => {
      const compoundInputs = [
        { input: 'brake and suspension system', expected: ['brakes', 'suspension'] },
        { input: 'engine and transmission fluid', expected: ['engine', 'transmission'] }
      ];

      compoundInputs.forEach(({ input, expected }) => {
        const categories = voiceProcessingService.extractCategories(input);
        expected.forEach(category => {
          expect(categories).toContain(category);
        });
      });
    });
  });

  describe('determineUrgencyLevel', () => {
    it('should detect critical urgency keywords', () => {
      const criticalInputs = [
        'immediate safety concern',
        'leaking brake fluid',
        'grinding brakes',
        'engine overheating',
        'steering wheel wobble'
      ];

      criticalInputs.forEach(input => {
        const urgency = voiceProcessingService.determineUrgencyLevel(input);
        expect(urgency).toBe('critical');
      });
    });

    it('should detect high urgency keywords', () => {
      const highInputs = [
        'worn brake pads',
        'low oil pressure',
        'battery dying',
        'tire wear',
        'needs replacement'
      ];

      highInputs.forEach(input => {
        const urgency = voiceProcessingService.determineUrgencyLevel(input);
        expect(urgency).toBe('high');
      });
    });

    it('should detect medium urgency keywords', () => {
      const mediumInputs = [
        'needs attention',
        'monitor closely',
        'due for service',
        'should replace soon',
        'getting worn'
      ];

      mediumInputs.forEach(input => {
        const urgency = voiceProcessingService.determineUrgencyLevel(input);
        expect(urgency).toBe('medium');
      });
    });

    it('should default to low urgency for positive conditions', () => {
      const lowInputs = [
        'good condition',
        'no issues',
        'recently replaced',
        'working properly',
        'excellent'
      ];

      lowInputs.forEach(input => {
        const urgency = voiceProcessingService.determineUrgencyLevel(input);
        expect(urgency).toBe('low');
      });
    });
  });

  describe('extractMeasurements', () => {
    it('should extract tread depth measurements', () => {
      const inputs = [
        { text: 'tread depth is 4/32 inches', expected: { tread_depth: 4/32, unit: 'inches' } },
        { text: '3mm tread remaining', expected: { tread_depth: 3, unit: 'mm' } },
        { text: 'down to 2/32', expected: { tread_depth: 2/32, unit: 'inches' } }
      ];

      inputs.forEach(({ text, expected }) => {
        const measurements = voiceProcessingService.extractMeasurements(text);
        expect(measurements.tread_depth).toBeCloseTo(expected.tread_depth, 3);
        expect(measurements.unit).toBe(expected.unit);
      });
    });

    it('should extract electrical measurements', () => {
      const inputs = [
        { text: 'battery voltage 12.6 volts', expected: { voltage: 12.6, unit: 'volts' } },
        { text: 'amperage reading 14.2 amps', expected: { amperage: 14.2, unit: 'amps' } },
        { text: 'resistance 1.5 ohms', expected: { resistance: 1.5, unit: 'ohms' } }
      ];

      inputs.forEach(({ text, expected }) => {
        const measurements = voiceProcessingService.extractMeasurements(text);
        Object.keys(expected).forEach(key => {
          expect(measurements[key]).toBe(expected[key]);
        });
      });
    });

    it('should extract percentage measurements', () => {
      const inputs = [
        { text: 'brake pad thickness at 20%', expected: { thickness_percent: 20 } },
        { text: '85% tread remaining', expected: { remaining_percent: 85 } },
        { text: 'worn down to 30 percent', expected: { wear_percent: 30 } }
      ];

      inputs.forEach(({ text, expected }) => {
        const measurements = voiceProcessingService.extractMeasurements(text);
        Object.keys(expected).forEach(key => {
          expect(measurements[key]).toBe(expected[key]);
        });
      });
    });
  });

  describe('generateSuggestions', () => {
    it('should suggest clarifying questions for ambiguous input', () => {
      // Arrange
      const ambiguousInput = 'something is wrong';

      // Act
      const suggestions = voiceProcessingService.generateSuggestions(ambiguousInput, 0.3);

      // Assert
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('Can you specify which component?');
      expect(suggestions).toContain('What symptoms are you observing?');
    });

    it('should suggest follow-up questions for incomplete information', () => {
      // Arrange
      const incompleteInput = 'brakes need work';

      // Act
      const suggestions = voiceProcessingService.generateSuggestions(incompleteInput, 0.6);

      // Assert
      expect(suggestions).toBeDefined();
      expect(suggestions).toContain('Which brake component specifically?');
      expect(suggestions).toContain('What is the current thickness measurement?');
    });

    it('should provide validation suggestions for technical details', () => {
      // Arrange
      const technicalInput = 'battery voltage low';

      // Act
      const suggestions = voiceProcessingService.generateSuggestions(technicalInput, 0.7);

      // Assert
      expect(suggestions).toBeDefined();
      expect(suggestions).toContain('Please provide the exact voltage reading');
      expect(suggestions).toContain('Was this measured with engine off or running?');
    });
  });

  describe('confidence scoring', () => {
    it('should give high confidence for clear, specific input', () => {
      const specificInputs = [
        'Front brake pads worn to 3mm thickness, need immediate replacement',
        'Oil level is 2 quarts low, recommend oil change service',
        'Tire pressure front left 28 PSI, should be 32 PSI'
      ];

      specificInputs.forEach(async (input) => {
        const result = await voiceProcessingService.processVoiceInput(input);
        expect(result.confidence).toBeGreaterThan(0.8);
      });
    });

    it('should give medium confidence for moderately clear input', () => {
      const moderateInputs = [
        'Brakes need some work',
        'Engine sounds a bit rough',
        'Tires are getting worn'
      ];

      moderateInputs.forEach(async (input) => {
        const result = await voiceProcessingService.processVoiceInput(input);
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.confidence).toBeLessThan(0.8);
      });
    });

    it('should give low confidence for vague input', () => {
      const vagueInputs = [
        'Something is wrong',
        'Not sure what the issue is',
        'Hmm, maybe needs attention'
      ];

      vagueInputs.forEach(async (input) => {
        const result = await voiceProcessingService.processVoiceInput(input);
        expect(result.confidence).toBeLessThan(0.5);
      });
    });
  });

  describe('context awareness', () => {
    it('should maintain context across related voice inputs', async () => {
      // Arrange
      const contextualInputs = [
        'Checking the brakes now',
        'Pads look worn',
        'About 20% thickness remaining'
      ];

      // Act
      let context = {};
      const results = [];
      
      for (const input of contextualInputs) {
        const result = await voiceProcessingService.processVoiceInput(input, context);
        results.push(result);
        context = result.context;
      }

      // Assert
      const finalResult = results[results.length - 1];
      expect(finalResult.parsed.category).toBe('brakes');
      expect(finalResult.parsed.item).toBe('brake_pads');
      expect(finalResult.parsed.measurements.thickness_percent).toBe(20);
      expect(finalResult.confidence).toBeGreaterThan(0.8);
    });

    it('should reset context for unrelated topics', async () => {
      // Arrange
      const context = { category: 'brakes', item: 'brake_pads' };
      const unrelatedInput = 'Now checking the engine oil level';

      // Act
      const result = await voiceProcessingService.processVoiceInput(unrelatedInput, context);

      // Assert
      expect(result.parsed.category).toBe('engine');
      expect(result.context.category).toBe('engine');
      expect(result.context.previous_category).toBe('brakes');
    });
  });
});
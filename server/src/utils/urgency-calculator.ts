// Urgency Calculator - Determines inspection priority based on conditions and measurements
// Implements business rules for calculating urgency levels across inspection items
// Supports configurable thresholds and shop-specific overrides

export interface UrgencyInput {
  condition: 'good' | 'fair' | 'poor' | 'needs_immediate';
  measurements?: Record<string, any>;
  itemType: string;
  priority?: number;
  estimatedCost?: number;
}

export interface UrgencyResult {
  level: 'low' | 'normal' | 'high' | 'critical';
  score: number; // 0-100
  factors: string[];
  recommendations: string[];
}

export interface UrgencyThresholds {
  critical: number;   // >= this score = critical
  high: number;       // >= this score = high  
  normal: number;     // >= this score = normal
  // < normal = low
}

// Default thresholds (can be overridden by shop configuration)
const DEFAULT_THRESHOLDS: UrgencyThresholds = {
  critical: 85,
  high: 65,
  normal: 35
};

// Condition-based scoring
const CONDITION_SCORES = {
  'good': 10,
  'fair': 40,
  'poor': 70,
  'needs_immediate': 95
};

// Item type specific modifiers and critical measurements
const ITEM_TYPE_CONFIG = {
  'brakes': {
    baseMultiplier: 1.5, // Brakes are critical safety
    criticalMeasurements: {
      'pad_thickness_mm': { critical: 2, poor: 4, fair: 6 },
      'rotor_thickness_mm': { critical: 8, poor: 10, fair: 12 }
    }
  },
  'tires': {
    baseMultiplier: 1.3,
    criticalMeasurements: {
      'tread_depth_32nds': { critical: 2, poor: 4, fair: 6 },
      'pressure_psi': { critical: 20, poor: 25, fair: 28 } // below recommended
    }
  },
  'battery': {
    baseMultiplier: 1.2,
    criticalMeasurements: {
      'voltage': { critical: 11.5, poor: 11.8, fair: 12.0 },
      'load_test_amps': { critical: 50, poor: 75, fair: 85 } // % of CCA
    }
  },
  'lights': {
    baseMultiplier: 1.1,
    criticalMeasurements: {
      'brightness_percent': { critical: 30, poor: 50, fair: 70 }
    }
  },
  'fluids': {
    baseMultiplier: 1.0,
    criticalMeasurements: {
      'level_percent': { critical: 20, poor: 40, fair: 60 },
      'condition_rating': { critical: 1, poor: 2, fair: 3 } // 1-5 scale
    }
  },
  'filters': {
    baseMultiplier: 0.8,
    criticalMeasurements: {
      'restriction_percent': { critical: 80, poor: 60, fair: 40 }
    }
  },
  'belts_hoses': {
    baseMultiplier: 1.0,
    criticalMeasurements: {
      'wear_percent': { critical: 80, poor: 60, fair: 40 },
      'crack_length_mm': { critical: 10, poor: 5, fair: 2 }
    }
  },
  'wipers': {
    baseMultiplier: 0.6,
    criticalMeasurements: {
      'effectiveness_percent': { critical: 40, poor: 60, fair: 75 }
    }
  }
};

export class UrgencyCalculator {
  private thresholds: UrgencyThresholds;
  
  constructor(customThresholds?: Partial<UrgencyThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };
  }
  
  // Calculate urgency for a single inspection item
  calculateItemUrgency(input: UrgencyInput): UrgencyResult {
    let score = 0;
    const factors: string[] = [];
    const recommendations: string[] = [];
    
    // Base score from condition
    const conditionScore = CONDITION_SCORES[input.condition] || 0;
    score += conditionScore;
    factors.push(`Condition: ${input.condition} (+${conditionScore})`);
    
    // Get item type configuration
    const itemConfig = ITEM_TYPE_CONFIG[input.itemType.toLowerCase()] || {
      baseMultiplier: 1.0,
      criticalMeasurements: {}
    };
    
    // Apply measurement-based scoring
    if (input.measurements && itemConfig.criticalMeasurements) {
      const measurementScore = this.calculateMeasurementScore(
        input.measurements, 
        itemConfig.criticalMeasurements
      );
      score += measurementScore.score;
      factors.push(...measurementScore.factors);
      recommendations.push(...measurementScore.recommendations);
    }
    
    // Apply item type multiplier
    score *= itemConfig.baseMultiplier;
    if (itemConfig.baseMultiplier !== 1.0) {
      factors.push(`Item type modifier: ${itemConfig.baseMultiplier}x`);
    }
    
    // Priority adjustment
    if (input.priority && input.priority > 1) {
      const priorityBonus = (input.priority - 1) * 5;
      score += priorityBonus;
      factors.push(`Priority level ${input.priority} (+${priorityBonus})`);
    }
    
    // Cost-based urgency (expensive items get slight priority boost)
    if (input.estimatedCost && input.estimatedCost > 500) {
      const costBonus = Math.min(input.estimatedCost / 100, 10);
      score += costBonus;
      factors.push(`High cost item (+${costBonus.toFixed(1)})`);
    }
    
    // Cap at 100
    score = Math.min(score, 100);
    
    // Determine level
    const level = this.scoreToLevel(score);
    
    // Add level-specific recommendations
    recommendations.push(...this.getLevelRecommendations(level, input.itemType));
    
    return {
      level,
      score: Math.round(score),
      factors,
      recommendations
    };
  }
  
  // Calculate urgency for entire inspection (aggregates all items)
  calculateInspectionUrgency(items: UrgencyInput[]): UrgencyResult {
    if (items.length === 0) {
      return {
        level: 'low',
        score: 0,
        factors: ['No inspection items'],
        recommendations: ['Add inspection items to determine urgency']
      };
    }
    
    const itemResults = items.map(item => this.calculateItemUrgency(item));
    
    // Count items by level
    const levelCounts = {
      critical: itemResults.filter(r => r.level === 'critical').length,
      high: itemResults.filter(r => r.level === 'high').length,
      normal: itemResults.filter(r => r.level === 'normal').length,
      low: itemResults.filter(r => r.level === 'low').length
    };
    
    // Determine overall urgency
    let overallLevel: 'low' | 'normal' | 'high' | 'critical';
    let overallScore: number;
    const factors: string[] = [];
    const recommendations: string[] = [];
    
    if (levelCounts.critical > 0) {
      overallLevel = 'critical';
      overallScore = 95;
      factors.push(`${levelCounts.critical} critical safety item(s)`);
      recommendations.push('IMMEDIATE ATTENTION REQUIRED - Do not drive vehicle');
      recommendations.push('Schedule urgent repair appointment');
    } else if (levelCounts.high >= 3 || (levelCounts.high >= 1 && levelCounts.normal >= 3)) {
      overallLevel = 'high';
      overallScore = 75;
      factors.push(`${levelCounts.high} high priority, ${levelCounts.normal} normal priority items`);
      recommendations.push('Schedule repair within 1-2 weeks');
      recommendations.push('Monitor driving conditions carefully');
    } else if (levelCounts.high >= 1 || levelCounts.normal >= 2) {
      overallLevel = 'normal';
      overallScore = 50;
      factors.push(`${levelCounts.high} high priority, ${levelCounts.normal} normal priority items`);
      recommendations.push('Schedule maintenance within 30 days');
      recommendations.push('Continue regular driving with awareness');
    } else {
      overallLevel = 'low';
      overallScore = 20;
      factors.push('All items in good or fair condition');
      recommendations.push('Continue regular maintenance schedule');
      recommendations.push('Re-inspect in 6 months or per manufacturer schedule');
    }
    
    // Add item-specific factors
    const highestScoreItem = itemResults.reduce((max, item) => 
      item.score > max.score ? item : max
    );
    
    if (highestScoreItem.score > 50) {
      factors.push(`Highest concern: ${highestScoreItem.score}/100`);
    }
    
    // Combine unique recommendations from all items
    const allRecommendations = new Set([
      ...recommendations,
      ...itemResults.flatMap(r => r.recommendations)
    ]);
    
    return {
      level: overallLevel,
      score: overallScore,
      factors,
      recommendations: Array.from(allRecommendations)
    };
  }
  
  // Calculate measurement-based scoring
  private calculateMeasurementScore(
    measurements: Record<string, any>,
    criticalMeasurements: Record<string, any>
  ): { score: number; factors: string[]; recommendations: string[] } {
    
    let score = 0;
    const factors: string[] = [];
    const recommendations: string[] = [];
    
    Object.entries(measurements).forEach(([key, value]) => {
      const thresholds = criticalMeasurements[key];
      if (!thresholds || typeof value !== 'number') return;
      
      let measurementScore = 0;
      let condition = '';
      
      if (value <= thresholds.critical) {
        measurementScore = 40;
        condition = 'critical';
        recommendations.push(`${key}: ${value} is critically low (≤${thresholds.critical})`);
      } else if (value <= thresholds.poor) {
        measurementScore = 25;
        condition = 'poor';
        recommendations.push(`${key}: ${value} is poor (≤${thresholds.poor})`);
      } else if (value <= thresholds.fair) {
        measurementScore = 10;
        condition = 'fair';
        recommendations.push(`${key}: ${value} is fair (≤${thresholds.fair})`);
      }
      
      if (measurementScore > 0) {
        score += measurementScore;
        factors.push(`${key}: ${value} (${condition}) +${measurementScore}`);
      }
    });
    
    return { score, factors, recommendations };
  }
  
  // Convert score to urgency level
  private scoreToLevel(score: number): 'low' | 'normal' | 'high' | 'critical' {
    if (score >= this.thresholds.critical) return 'critical';
    if (score >= this.thresholds.high) return 'high';
    if (score >= this.thresholds.normal) return 'normal';
    return 'low';
  }
  
  // Get recommendations based on urgency level and item type
  private getLevelRecommendations(level: string, itemType: string): string[] {
    const recommendations: string[] = [];
    
    switch (level) {
      case 'critical':
        recommendations.push('STOP DRIVING - Immediate safety risk');
        recommendations.push('Contact shop immediately');
        break;
      case 'high':
        recommendations.push('Schedule repair within 1-2 weeks');
        recommendations.push('Monitor condition closely');
        break;
      case 'normal':
        recommendations.push('Schedule maintenance within 30 days');
        break;
      case 'low':
        recommendations.push('Monitor during regular maintenance');
        break;
    }
    
    // Item-specific recommendations
    switch (itemType.toLowerCase()) {
      case 'brakes':
        if (level === 'critical' || level === 'high') {
          recommendations.push('Avoid heavy braking and steep hills');
          recommendations.push('Check brake fluid level');
        }
        break;
      case 'tires':
        if (level === 'critical' || level === 'high') {
          recommendations.push('Reduce speed in wet conditions');
          recommendations.push('Check tire pressure weekly');
        }
        break;
      case 'battery':
        if (level === 'critical' || level === 'high') {
          recommendations.push('Carry jumper cables');
          recommendations.push('Avoid leaving lights/accessories on');
        }
        break;
    }
    
    return recommendations;
  }
  
  // Update thresholds (for shop-specific configuration)
  updateThresholds(newThresholds: Partial<UrgencyThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }
  
  // Get current thresholds
  getThresholds(): UrgencyThresholds {
    return { ...this.thresholds };
  }
}

// Export convenience function for quick calculations
export function calculateUrgency(
  input: UrgencyInput, 
  customThresholds?: Partial<UrgencyThresholds>
): UrgencyResult {
  const calculator = new UrgencyCalculator(customThresholds);
  return calculator.calculateItemUrgency(input);
}

// Export convenience function for inspection-level calculations
export function calculateInspectionUrgency(
  items: UrgencyInput[],
  customThresholds?: Partial<UrgencyThresholds>
): UrgencyResult {
  const calculator = new UrgencyCalculator(customThresholds);
  return calculator.calculateInspectionUrgency(items);
}
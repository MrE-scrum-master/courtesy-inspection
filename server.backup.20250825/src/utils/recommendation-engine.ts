// Recommendation Engine - Generates actionable recommendations for inspection items
// Provides maintenance suggestions, cost estimates, and next service predictions
// Supports business rules and common issue pattern detection

export interface RecommendationInput {
  itemType: string;
  condition: 'good' | 'fair' | 'poor' | 'needs_immediate';
  measurements?: Record<string, any>;
  vehicleInfo?: {
    year?: number;
    make?: string;
    model?: string;
    mileage?: number;
  };
  history?: InspectionItemHistory[];
  shopConfig?: ShopRecommendationConfig;
}

export interface InspectionItemHistory {
  date: Date;
  condition: string;
  measurements?: Record<string, any>;
  recommendations?: string;
}

export interface ShopRecommendationConfig {
  includeCostEstimates: boolean;
  includePartNumbers: boolean;
  includeTimeframes: boolean;
  laborRate?: number; // per hour
  markupPercent?: number;
}

export interface Recommendation {
  type: 'maintenance' | 'replacement' | 'inspection' | 'monitoring' | 'immediate_action';
  urgency: 'immediate' | 'soon' | 'scheduled' | 'routine';
  title: string;
  description: string;
  estimatedCost?: {
    parts: number;
    labor: number;
    total: number;
  };
  timeframe?: string;
  partNumbers?: string[];
  laborHours?: number;
  reason: string;
  benefits?: string[];
}

export interface RecommendationResult {
  primary: Recommendation;
  secondary: Recommendation[];
  preventive: Recommendation[];
  nextServiceDate?: Date;
  totalEstimatedCost?: number;
  patterns?: string[];
}

// Cost database (simplified - in production would be more comprehensive)
const COST_DATABASE = {
  'brakes': {
    'brake_pads_front': { parts: 75, labor: 1.5 },
    'brake_pads_rear': { parts: 65, labor: 1.0 },
    'brake_rotors_front': { parts: 180, labor: 2.0 },
    'brake_rotors_rear': { parts: 160, labor: 1.5 },
    'brake_fluid_change': { parts: 15, labor: 0.5 },
    'brake_inspection': { parts: 0, labor: 0.5 }
  },
  'tires': {
    'tire_replacement_each': { parts: 120, labor: 0.5 },
    'tire_rotation': { parts: 0, labor: 0.5 },
    'wheel_alignment': { parts: 0, labor: 1.0 },
    'tire_pressure_check': { parts: 0, labor: 0.1 }
  },
  'battery': {
    'battery_replacement': { parts: 150, labor: 0.5 },
    'battery_test': { parts: 0, labor: 0.25 },
    'terminal_cleaning': { parts: 5, labor: 0.25 }
  },
  'fluids': {
    'oil_change': { parts: 35, labor: 0.5 },
    'coolant_flush': { parts: 45, labor: 1.0 },
    'transmission_service': { parts: 85, labor: 1.5 }
  },
  'filters': {
    'air_filter': { parts: 25, labor: 0.25 },
    'cabin_filter': { parts: 30, labor: 0.5 },
    'fuel_filter': { parts: 40, labor: 1.0 }
  }
};

// Service intervals (miles or months)
const SERVICE_INTERVALS = {
  'brakes': { inspection: 12000, replacement: 35000 },
  'tires': { rotation: 6000, replacement: 50000 },
  'battery': { test: 24000, replacement: 72000 },
  'oil': { change: 5000 },
  'coolant': { check: 12000, flush: 60000 },
  'air_filter': { replacement: 15000 },
  'cabin_filter': { replacement: 18000 }
};

export class RecommendationEngine {
  private defaultLaborRate: number = 120; // per hour
  private defaultMarkup: number = 0.15; // 15%
  
  constructor(
    private laborRate?: number,
    private markupPercent?: number
  ) {
    this.defaultLaborRate = laborRate || this.defaultLaborRate;
    this.defaultMarkup = markupPercent || this.defaultMarkup;
  }
  
  // Generate recommendations for a single inspection item
  generateRecommendations(input: RecommendationInput): RecommendationResult {
    const recommendations: Recommendation[] = [];
    const preventive: Recommendation[] = [];
    let patterns: string[] = [];
    
    // Generate condition-based recommendations
    const conditionRecs = this.getConditionBasedRecommendations(input);
    recommendations.push(...conditionRecs);
    
    // Generate measurement-based recommendations
    if (input.measurements) {
      const measurementRecs = this.getMeasurementBasedRecommendations(input);
      recommendations.push(...measurementRecs);
    }
    
    // Generate history-based patterns
    if (input.history && input.history.length > 1) {
      const historyAnalysis = this.analyzeHistory(input.history);
      patterns = historyAnalysis.patterns;
      if (historyAnalysis.recommendations.length > 0) {
        recommendations.push(...historyAnalysis.recommendations);
      }
    }
    
    // Generate preventive recommendations
    const preventiveRecs = this.getPreventiveRecommendations(input);
    preventive.push(...preventiveRecs);
    
    // Sort recommendations by urgency and importance
    const sortedRecs = this.sortRecommendations(recommendations);
    
    // Calculate next service date
    const nextServiceDate = this.calculateNextServiceDate(input);
    
    // Calculate total estimated cost
    const totalEstimatedCost = sortedRecs.reduce(
      (sum, rec) => sum + (rec.estimatedCost?.total || 0), 0
    );
    
    return {
      primary: sortedRecs[0],
      secondary: sortedRecs.slice(1),
      preventive,
      nextServiceDate,
      totalEstimatedCost: totalEstimatedCost > 0 ? totalEstimatedCost : undefined,
      patterns: patterns.length > 0 ? patterns : undefined
    };
  }
  
  // Generate condition-based recommendations
  private getConditionBasedRecommendations(input: RecommendationInput): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const { itemType, condition, vehicleInfo, shopConfig } = input;
    
    switch (condition) {
      case 'needs_immediate':
        recommendations.push({
          type: 'immediate_action',
          urgency: 'immediate',
          title: `Immediate ${itemType} attention required`,
          description: this.getImmediateActionDescription(itemType),
          reason: 'Safety-critical condition detected',
          benefits: ['Prevent accidents', 'Avoid further damage', 'Ensure safe operation'],
          ...this.getCostEstimate(itemType, 'replacement', shopConfig)
        });
        break;
        
      case 'poor':
        recommendations.push({
          type: 'replacement',
          urgency: 'soon',
          title: `${itemType} replacement recommended`,
          description: this.getReplacementDescription(itemType),
          timeframe: this.getTimeframe(itemType, 'poor'),
          reason: 'Component showing significant wear',
          benefits: ['Restore performance', 'Prevent breakdown', 'Improve safety'],
          ...this.getCostEstimate(itemType, 'replacement', shopConfig)
        });
        break;
        
      case 'fair':
        recommendations.push({
          type: 'monitoring',
          urgency: 'scheduled',
          title: `Monitor ${itemType} condition`,
          description: this.getMonitoringDescription(itemType),
          timeframe: this.getTimeframe(itemType, 'fair'),
          reason: 'Component showing early wear signs',
          benefits: ['Plan ahead for replacement', 'Monitor degradation', 'Prevent surprises'],
          ...this.getCostEstimate(itemType, 'inspection', shopConfig)
        });
        break;
        
      case 'good':
        recommendations.push({
          type: 'maintenance',
          urgency: 'routine',
          title: `Continue regular ${itemType} maintenance`,
          description: this.getMaintenanceDescription(itemType),
          timeframe: this.getTimeframe(itemType, 'good'),
          reason: 'Component in good condition',
          benefits: ['Extend component life', 'Maintain performance', 'Prevent premature wear']
        });
        break;
    }
    
    return recommendations;
  }
  
  // Generate measurement-based recommendations
  private getMeasurementBasedRecommendations(input: RecommendationInput): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const { itemType, measurements, shopConfig } = input;
    
    if (!measurements) return recommendations;
    
    switch (itemType.toLowerCase()) {
      case 'brakes':
        if (measurements.pad_thickness_mm !== undefined) {
          const thickness = measurements.pad_thickness_mm;
          if (thickness <= 2) {
            recommendations.push({
              type: 'immediate_action',
              urgency: 'immediate',
              title: 'Brake pad replacement required immediately',
              description: `Brake pad thickness is ${thickness}mm, below minimum safe thickness`,
              reason: 'Safety critical - metal-on-metal contact imminent',
              benefits: ['Prevent brake damage', 'Ensure stopping power', 'Avoid costly rotor replacement'],
              ...this.getCostEstimate('brakes', 'brake_pads_front', shopConfig)
            });
          } else if (thickness <= 4) {
            recommendations.push({
              type: 'replacement',
              urgency: 'soon',
              title: 'Brake pad replacement needed soon',
              description: `Brake pad thickness is ${thickness}mm, approaching minimum thickness`,
              timeframe: 'Within 2-4 weeks',
              reason: 'Preventing damage to brake rotors',
              benefits: ['Maintain braking performance', 'Avoid rotor replacement'],
              ...this.getCostEstimate('brakes', 'brake_pads_front', shopConfig)
            });
          }
        }
        break;
        
      case 'tires':
        if (measurements.tread_depth_32nds !== undefined) {
          const tread = measurements.tread_depth_32nds;
          if (tread <= 2) {
            recommendations.push({
              type: 'immediate_action',
              urgency: 'immediate',
              title: 'Tire replacement required - unsafe tread depth',
              description: `Tread depth is ${tread}/32", below legal minimum`,
              reason: 'Unsafe in wet conditions - risk of hydroplaning',
              benefits: ['Restore traction', 'Improve stopping distance', 'Legal compliance'],
              ...this.getCostEstimate('tires', 'tire_replacement_each', shopConfig)
            });
          } else if (tread <= 4) {
            recommendations.push({
              type: 'replacement',
              urgency: 'soon',
              title: 'Tire replacement recommended',
              description: `Tread depth is ${tread}/32", getting close to minimum`,
              timeframe: 'Within 1-2 months',
              reason: 'Maintaining traction and safety',
              benefits: ['Better wet weather performance', 'Improved fuel economy'],
              ...this.getCostEstimate('tires', 'tire_replacement_each', shopConfig)
            });
          }
        }
        break;
        
      case 'battery':
        if (measurements.voltage !== undefined) {
          const voltage = measurements.voltage;
          if (voltage < 11.5) {
            recommendations.push({
              type: 'immediate_action',
              urgency: 'immediate',
              title: 'Battery replacement required',
              description: `Battery voltage is ${voltage}V, well below normal range`,
              reason: 'Risk of no-start condition',
              benefits: ['Reliable starting', 'Proper electrical system operation'],
              ...this.getCostEstimate('battery', 'battery_replacement', shopConfig)
            });
          } else if (voltage < 12.0) {
            recommendations.push({
              type: 'replacement',
              urgency: 'soon',
              title: 'Battery replacement recommended',
              description: `Battery voltage is ${voltage}V, below optimal range`,
              timeframe: 'Within 2-4 weeks',
              reason: 'Preventing unexpected failure',
              benefits: ['Avoid being stranded', 'Protect other electrical components'],
              ...this.getCostEstimate('battery', 'battery_replacement', shopConfig)
            });
          }
        }
        break;
    }
    
    return recommendations;
  }
  
  // Analyze historical patterns
  private analyzeHistory(history: InspectionItemHistory[]): { patterns: string[], recommendations: Recommendation[] } {
    const patterns: string[] = [];
    const recommendations: Recommendation[] = [];
    
    if (history.length < 2) return { patterns, recommendations };
    
    // Sort by date
    const sortedHistory = history.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Check for degradation pattern
    const conditions = ['good', 'fair', 'poor', 'needs_immediate'];
    let degrading = true;
    for (let i = 1; i < sortedHistory.length; i++) {
      const prevIndex = conditions.indexOf(sortedHistory[i-1].condition);
      const currIndex = conditions.indexOf(sortedHistory[i].condition);
      if (currIndex <= prevIndex) {
        degrading = false;
        break;
      }
    }
    
    if (degrading) {
      patterns.push('Condition consistently degrading');
      const timeDiff = sortedHistory[sortedHistory.length-1].date.getTime() - sortedHistory[0].date.getTime();
      const monthsDiff = timeDiff / (1000 * 60 * 60 * 24 * 30);
      
      if (monthsDiff < 6) {
        patterns.push('Faster than expected degradation');
        recommendations.push({
          type: 'inspection',
          urgency: 'soon',
          title: 'Investigate rapid deterioration',
          description: 'Component is degrading faster than typical',
          timeframe: 'Next service visit',
          reason: 'Unusual wear pattern detected',
          benefits: ['Identify root cause', 'Prevent premature failure', 'Optimize replacement timing']
        });
      }
    }
    
    // Check for oscillating conditions (good/bad/good pattern)
    let oscillating = false;
    if (sortedHistory.length >= 3) {
      for (let i = 2; i < sortedHistory.length; i++) {
        const conditions = [
          sortedHistory[i-2].condition,
          sortedHistory[i-1].condition,
          sortedHistory[i].condition
        ];
        if ((conditions[0] === 'good' && conditions[1] === 'poor' && conditions[2] === 'good') ||
            (conditions[0] === 'poor' && conditions[1] === 'good' && conditions[2] === 'poor')) {
          oscillating = true;
          break;
        }
      }
    }
    
    if (oscillating) {
      patterns.push('Inconsistent condition assessments');
      recommendations.push({
        type: 'inspection',
        urgency: 'routine',
        title: 'Verify assessment criteria',
        description: 'Previous assessments show inconsistent results',
        reason: 'Ensuring accurate condition evaluation',
        benefits: ['Consistent assessments', 'Better maintenance planning', 'Improved reliability']
      });
    }
    
    return { patterns, recommendations };
  }
  
  // Generate preventive maintenance recommendations
  private getPreventiveRecommendations(input: RecommendationInput): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const { itemType, vehicleInfo, shopConfig } = input;
    
    if (!vehicleInfo?.mileage) return recommendations;
    
    const intervals = SERVICE_INTERVALS[itemType.toLowerCase()];
    if (!intervals) return recommendations;
    
    // Check if due for routine service
    Object.entries(intervals).forEach(([serviceType, interval]) => {
      const milesSinceService = vehicleInfo.mileage! % interval;
      const milesUntilDue = interval - milesSinceService;
      
      if (milesUntilDue <= 1000) { // Due within 1000 miles
        recommendations.push({
          type: 'maintenance',
          urgency: milesUntilDue <= 0 ? 'soon' : 'scheduled',
          title: `${serviceType} service ${milesUntilDue <= 0 ? 'overdue' : 'due soon'}`,
          description: `${serviceType} service is ${milesUntilDue <= 0 ? 'overdue by ' + Math.abs(milesUntilDue) : 'due in ' + milesUntilDue} miles`,
          timeframe: milesUntilDue <= 0 ? 'As soon as possible' : 'Next 1000 miles',
          reason: 'Following manufacturer maintenance schedule',
          benefits: ['Maintain warranty', 'Prevent breakdowns', 'Optimize performance'],
          ...this.getCostEstimate(itemType, serviceType, shopConfig)
        });
      }
    });
    
    return recommendations;
  }
  
  // Get cost estimate for service
  private getCostEstimate(
    itemType: string, 
    serviceType: string, 
    shopConfig?: ShopRecommendationConfig
  ): Partial<Recommendation> {
    
    if (!shopConfig?.includeCostEstimates) return {};
    
    const costs = COST_DATABASE[itemType.toLowerCase()]?.[serviceType];
    if (!costs) return {};
    
    const laborRate = shopConfig.laborRate || this.defaultLaborRate;
    const markup = shopConfig.markupPercent || this.defaultMarkup;
    
    const partsWithMarkup = costs.parts * (1 + markup);
    const laborCost = costs.labor * laborRate;
    const total = partsWithMarkup + laborCost;
    
    return {
      estimatedCost: {
        parts: Math.round(partsWithMarkup),
        labor: Math.round(laborCost),
        total: Math.round(total)
      },
      laborHours: costs.labor
    };
  }
  
  // Sort recommendations by priority
  private sortRecommendations(recommendations: Recommendation[]): Recommendation[] {
    const urgencyOrder = { 'immediate': 0, 'soon': 1, 'scheduled': 2, 'routine': 3 };
    const typeOrder = { 'immediate_action': 0, 'replacement': 1, 'maintenance': 2, 'inspection': 3, 'monitoring': 4 };
    
    return recommendations.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      
      return typeOrder[a.type] - typeOrder[b.type];
    });
  }
  
  // Calculate next service date
  private calculateNextServiceDate(input: RecommendationInput): Date | undefined {
    const { itemType, condition, vehicleInfo } = input;
    
    if (!vehicleInfo?.mileage) return undefined;
    
    const intervals = SERVICE_INTERVALS[itemType.toLowerCase()];
    if (!intervals) return undefined;
    
    // Estimate based on condition and typical driving (12,000 miles/year)
    let milesUntilService: number;
    
    switch (condition) {
      case 'needs_immediate':
        milesUntilService = 0;
        break;
      case 'poor':
        milesUntilService = 1000;
        break;
      case 'fair':
        milesUntilService = intervals.inspection || 5000;
        break;
      case 'good':
        milesUntilService = intervals.replacement || 15000;
        break;
      default:
        return undefined;
    }
    
    // Convert miles to months (assuming 1000 miles/month average)
    const monthsUntilService = milesUntilService / 1000;
    
    const nextServiceDate = new Date();
    nextServiceDate.setMonth(nextServiceDate.getMonth() + monthsUntilService);
    
    return nextServiceDate;
  }
  
  // Helper methods for descriptions
  private getImmediateActionDescription(itemType: string): string {
    const descriptions = {
      'brakes': 'Brake system requires immediate attention. Do not drive until repaired.',
      'tires': 'Tire condition is unsafe. Replace immediately before driving.',
      'battery': 'Battery is failing. Vehicle may not start reliably.',
      'lights': 'Safety lighting is not functioning properly.',
      'default': `${itemType} requires immediate attention for safety.`
    };
    return descriptions[itemType.toLowerCase()] || descriptions.default;
  }
  
  private getReplacementDescription(itemType: string): string {
    return `${itemType} component is showing significant wear and should be replaced soon to prevent failure.`;
  }
  
  private getMonitoringDescription(itemType: string): string {
    return `${itemType} is in fair condition. Monitor closely and plan for future replacement.`;
  }
  
  private getMaintenanceDescription(itemType: string): string {
    return `${itemType} is in good condition. Continue regular maintenance to ensure longevity.`;
  }
  
  private getTimeframe(itemType: string, condition: string): string {
    const timeframes = {
      'needs_immediate': 'Immediately',
      'poor': '1-2 weeks',
      'fair': '1-3 months',
      'good': '6-12 months'
    };
    return timeframes[condition] || 'As needed';
  }
}

// Export convenience function
export function generateRecommendations(
  input: RecommendationInput,
  laborRate?: number,
  markupPercent?: number
): RecommendationResult {
  const engine = new RecommendationEngine(laborRate, markupPercent);
  return engine.generateRecommendations(input);
}
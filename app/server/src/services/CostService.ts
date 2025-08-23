import { Pool } from 'pg';
import { Logger } from '../utils/Logger';

export interface CostEntry {
  id: number;
  shop_id: number;
  cost_type: 'sms' | 'report_generation' | 'storage' | 'api_calls' | 'other';
  cost_cents: number;
  quantity: number;
  unit_cost_cents: number;
  description: string;
  billing_date: Date;
  metadata: any;
}

export interface ShopCostSummary {
  shop_id: number;
  period: {
    start_date: Date;
    end_date: Date;
  };
  total_cost_cents: number;
  by_type: Record<string, {
    cost_cents: number;
    quantity: number;
    percentage: number;
  }>;
  budget_status: {
    monthly_budget_cents: number;
    spent_percentage: number;
    remaining_cents: number;
    is_over_budget: boolean;
  };
  projections: {
    monthly_projected_cents: number;
    annual_projected_cents: number;
  };
}

export interface CostOptimization {
  type: 'sms' | 'storage' | 'api_calls' | 'general';
  title: string;
  description: string;
  potential_savings_cents: number;
  difficulty: 'easy' | 'medium' | 'hard';
  implementation_time: string;
  priority: 'low' | 'medium' | 'high';
}

export interface BudgetAlert {
  shop_id: number;
  alert_type: 'approaching_limit' | 'over_budget' | 'unusual_activity';
  cost_type: string;
  current_amount_cents: number;
  budget_limit_cents: number;
  percentage_used: number;
  created_at: Date;
}

export class CostService {
  private readonly pool: Pool;
  private readonly logger: Logger;

  // Cost thresholds for alerts
  private readonly alertThresholds = {
    approaching_limit: 80, // 80% of budget
    over_budget: 100, // 100% of budget
    unusual_activity_multiplier: 2.0, // 2x normal usage
  };

  constructor(pool: Pool) {
    this.pool = pool;
    this.logger = new Logger('CostService');
  }

  /**
   * Record a cost entry
   */
  async recordCost(
    shopId: number,
    costType: 'sms' | 'report_generation' | 'storage' | 'api_calls' | 'other',
    costCents: number,
    quantity: number = 1,
    description: string = '',
    metadata: any = {}
  ): Promise<CostEntry> {
    const unitCostCents = quantity > 0 ? Math.round(costCents / quantity) : costCents;

    const query = `
      INSERT INTO shop_costs (
        shop_id, cost_type, cost_cents, quantity, unit_cost_cents, description, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      shopId,
      costType,
      costCents,
      quantity,
      unitCostCents,
      description,
      JSON.stringify(metadata),
    ];

    const result = await this.pool.query(query, values);
    const costEntry = result.rows[0];

    this.logger.debug('Cost recorded', {
      shopId,
      costType,
      costCents,
      quantity,
      description,
    });

    // Check for budget alerts
    await this.checkBudgetAlerts(shopId, costType, costCents);

    return costEntry;
  }

  /**
   * Track SMS cost
   */
  async trackSMSCost(messageId: number, costCents: number): Promise<void> {
    // Get message details for cost tracking
    const query = `
      SELECT shop_id, to_phone, message_text 
      FROM sms_messages 
      WHERE id = $1
    `;
    
    const result = await this.pool.query(query, [messageId]);
    
    if (result.rows.length === 0) {
      this.logger.warn('SMS message not found for cost tracking', { messageId });
      return;
    }

    const message = result.rows[0];
    
    await this.recordCost(
      message.shop_id,
      'sms',
      costCents,
      1,
      `SMS to ${message.to_phone}`,
      {
        message_id: messageId,
        message_length: message.message_text.length,
        segments: Math.ceil(message.message_text.length / 160),
      }
    );
  }

  /**
   * Get estimated monthly cost for a shop
   */
  async estimateMonthlyCost(shopId: number): Promise<number> {
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const currentDay = currentDate.getDate();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

    // Get current month's costs so far
    const query = `
      SELECT COALESCE(SUM(cost_cents), 0) as current_cost
      FROM shop_costs 
      WHERE shop_id = $1 
      AND billing_date >= $2
      AND billing_date <= $3
    `;

    const result = await this.pool.query(query, [shopId, startOfMonth, currentDate]);
    const currentCostCents = parseInt(result.rows[0].current_cost);

    // Project for full month
    const dailyAverage = currentCostCents / currentDay;
    const projectedMonthlyCost = Math.round(dailyAverage * daysInMonth);

    return projectedMonthlyCost;
  }

  /**
   * Generate cost report for a shop
   */
  async generateCostReport(shopId: number, startDate: Date, endDate: Date): Promise<ShopCostSummary> {
    // Get total costs by type
    const costsQuery = `
      SELECT 
        cost_type,
        SUM(cost_cents) as total_cost_cents,
        SUM(quantity) as total_quantity,
        COUNT(*) as transaction_count
      FROM shop_costs 
      WHERE shop_id = $1 
      AND billing_date BETWEEN $2 AND $3
      GROUP BY cost_type
    `;

    const costsResult = await this.pool.query(costsQuery, [shopId, startDate, endDate]);
    
    let totalCostCents = 0;
    const byType: Record<string, { cost_cents: number; quantity: number; percentage: number }> = {};

    // Calculate totals and by-type breakdown
    for (const row of costsResult.rows) {
      const costCents = parseInt(row.total_cost_cents);
      totalCostCents += costCents;
      
      byType[row.cost_type] = {
        cost_cents: costCents,
        quantity: parseInt(row.total_quantity),
        percentage: 0, // Will be calculated after total is known
      };
    }

    // Calculate percentages
    for (const type in byType) {
      byType[type].percentage = totalCostCents > 0 
        ? Math.round((byType[type].cost_cents / totalCostCents) * 100)
        : 0;
    }

    // Get shop budget info
    const budgetQuery = 'SELECT monthly_sms_budget_cents FROM shops WHERE id = $1';
    const budgetResult = await this.pool.query(budgetQuery, [shopId]);
    const monthlyBudgetCents = parseInt(budgetResult.rows[0]?.monthly_sms_budget_cents || '500000'); // Default $5000

    // Calculate budget status
    const spentPercentage = monthlyBudgetCents > 0 
      ? Math.round((totalCostCents / monthlyBudgetCents) * 100)
      : 0;

    const budgetStatus = {
      monthly_budget_cents: monthlyBudgetCents,
      spent_percentage: spentPercentage,
      remaining_cents: Math.max(0, monthlyBudgetCents - totalCostCents),
      is_over_budget: totalCostCents > monthlyBudgetCents,
    };

    // Calculate projections
    const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyAverage = daysInPeriod > 0 ? totalCostCents / daysInPeriod : 0;
    
    const projections = {
      monthly_projected_cents: Math.round(dailyAverage * 30),
      annual_projected_cents: Math.round(dailyAverage * 365),
    };

    return {
      shop_id: shopId,
      period: {
        start_date: startDate,
        end_date: endDate,
      },
      total_cost_cents: totalCostCents,
      by_type: byType,
      budget_status: budgetStatus,
      projections,
    };
  }

  /**
   * Suggest cost optimizations
   */
  async suggestOptimizations(shopId: number): Promise<CostOptimization[]> {
    const optimizations: CostOptimization[] = [];
    
    // Get last 30 days of costs for analysis
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    
    const costReport = await this.generateCostReport(shopId, thirtyDaysAgo, now);

    // SMS optimization suggestions
    if (costReport.by_type.sms) {
      const smsCost = costReport.by_type.sms.cost_cents;
      const smsQuantity = costReport.by_type.sms.quantity;
      
      if (smsCost > 10000) { // More than $100/month on SMS
        optimizations.push({
          type: 'sms',
          title: 'Optimize SMS Message Length',
          description: 'Review SMS templates to reduce message length and avoid multi-part messages. Each SMS segment over 160 characters costs extra.',
          potential_savings_cents: Math.round(smsCost * 0.15), // 15% potential savings
          difficulty: 'easy',
          implementation_time: '1-2 hours',
          priority: 'medium',
        });
      }

      if (smsQuantity > 1000) { // High volume
        optimizations.push({
          type: 'sms',
          title: 'Implement SMS Batching',
          description: 'Group similar notifications and send them in batches during off-peak hours to reduce costs.',
          potential_savings_cents: Math.round(smsCost * 0.10), // 10% potential savings
          difficulty: 'medium',
          implementation_time: '4-6 hours',
          priority: 'medium',
        });
      }
    }

    // General optimizations
    if (costReport.total_cost_cents > 50000) { // More than $500/month total
      optimizations.push({
        type: 'general',
        title: 'Review Communication Frequency',
        description: 'Analyze customer communication patterns to reduce unnecessary messages while maintaining service quality.',
        potential_savings_cents: Math.round(costReport.total_cost_cents * 0.20), // 20% potential savings
        difficulty: 'medium',
        implementation_time: '2-3 days',
        priority: 'high',
      });
    }

    // Storage optimization (if storage costs exist)
    if (costReport.by_type.storage) {
      optimizations.push({
        type: 'storage',
        title: 'Implement Data Archiving',
        description: 'Archive old inspection photos and reports to cheaper storage tiers after 90 days.',
        potential_savings_cents: Math.round(costReport.by_type.storage.cost_cents * 0.60), // 60% potential savings
        difficulty: 'hard',
        implementation_time: '1-2 weeks',
        priority: 'low',
      });
    }

    // Sort by priority and potential savings
    optimizations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.potential_savings_cents - a.potential_savings_cents;
    });

    return optimizations;
  }

  /**
   * Set spending limits for a shop
   */
  async setSpendingLimits(
    shopId: number,
    limits: {
      monthly_sms_budget_cents?: number;
      daily_sms_limit_cents?: number;
      alert_threshold_percentage?: number;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (limits.monthly_sms_budget_cents !== undefined) {
      updates.push(`monthly_sms_budget_cents = $${paramCount++}`);
      values.push(limits.monthly_sms_budget_cents);
    }

    if (updates.length === 0) {
      return;
    }

    values.push(shopId);
    const query = `
      UPDATE shops 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
    `;

    await this.pool.query(query, values);

    this.logger.info('Spending limits updated', {
      shopId,
      limits,
    });
  }

  /**
   * Get cost trends and analytics
   */
  async getCostTrends(shopId: number, days: number = 30): Promise<{
    daily_costs: Array<{ date: string; cost_cents: number; by_type: Record<string, number> }>;
    trends: {
      total_change_percentage: number;
      sms_change_percentage: number;
      average_daily_cost: number;
    };
  }> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const query = `
      SELECT 
        DATE(billing_date) as date,
        cost_type,
        SUM(cost_cents) as cost_cents
      FROM shop_costs 
      WHERE shop_id = $1 
      AND billing_date BETWEEN $2 AND $3
      GROUP BY DATE(billing_date), cost_type
      ORDER BY DATE(billing_date), cost_type
    `;

    const result = await this.pool.query(query, [shopId, startDate, endDate]);

    // Group by date
    const dailyCostsMap = new Map<string, { cost_cents: number; by_type: Record<string, number> }>();
    
    for (const row of result.rows) {
      const dateStr = row.date.toISOString().split('T')[0];
      const costCents = parseInt(row.cost_cents);
      
      if (!dailyCostsMap.has(dateStr)) {
        dailyCostsMap.set(dateStr, { cost_cents: 0, by_type: {} });
      }
      
      const dayData = dailyCostsMap.get(dateStr)!;
      dayData.cost_cents += costCents;
      dayData.by_type[row.cost_type] = costCents;
    }

    const dailyCosts = Array.from(dailyCostsMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    // Calculate trends
    const firstHalf = dailyCosts.slice(0, Math.floor(dailyCosts.length / 2));
    const secondHalf = dailyCosts.slice(Math.floor(dailyCosts.length / 2));

    const firstHalfTotal = firstHalf.reduce((sum, day) => sum + day.cost_cents, 0);
    const secondHalfTotal = secondHalf.reduce((sum, day) => sum + day.cost_cents, 0);

    const totalChangePercentage = firstHalfTotal > 0 
      ? Math.round(((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100)
      : 0;

    const firstHalfSMS = firstHalf.reduce((sum, day) => sum + (day.by_type.sms || 0), 0);
    const secondHalfSMS = secondHalf.reduce((sum, day) => sum + (day.by_type.sms || 0), 0);

    const smsChangePercentage = firstHalfSMS > 0 
      ? Math.round(((secondHalfSMS - firstHalfSMS) / firstHalfSMS) * 100)
      : 0;

    const totalCosts = dailyCosts.reduce((sum, day) => sum + day.cost_cents, 0);
    const averageDailyCost = dailyCosts.length > 0 ? Math.round(totalCosts / dailyCosts.length) : 0;

    return {
      daily_costs: dailyCosts,
      trends: {
        total_change_percentage: totalChangePercentage,
        sms_change_percentage: smsChangePercentage,
        average_daily_cost: averageDailyCost,
      },
    };
  }

  // Private helper methods

  private async checkBudgetAlerts(shopId: number, costType: string, newCostCents: number): Promise<void> {
    try {
      // Get current month costs
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      
      const query = `
        SELECT COALESCE(SUM(cost_cents), 0) as total_cost
        FROM shop_costs 
        WHERE shop_id = $1 
        AND cost_type = $2
        AND billing_date >= $3
      `;

      const result = await this.pool.query(query, [shopId, costType, startOfMonth]);
      const totalCostCents = parseInt(result.rows[0].total_cost) + newCostCents;

      // Get budget limit
      const budgetQuery = 'SELECT monthly_sms_budget_cents FROM shops WHERE id = $1';
      const budgetResult = await this.pool.query(budgetQuery, [shopId]);
      const budgetLimitCents = parseInt(budgetResult.rows[0]?.monthly_sms_budget_cents || '500000');

      const percentageUsed = (totalCostCents / budgetLimitCents) * 100;

      // Check for alerts
      if (percentageUsed >= this.alertThresholds.over_budget) {
        await this.createBudgetAlert(shopId, 'over_budget', costType, totalCostCents, budgetLimitCents, percentageUsed);
      } else if (percentageUsed >= this.alertThresholds.approaching_limit) {
        await this.createBudgetAlert(shopId, 'approaching_limit', costType, totalCostCents, budgetLimitCents, percentageUsed);
      }

    } catch (error) {
      this.logger.error('Failed to check budget alerts:', error);
    }
  }

  private async createBudgetAlert(
    shopId: number,
    alertType: 'approaching_limit' | 'over_budget' | 'unusual_activity',
    costType: string,
    currentAmountCents: number,
    budgetLimitCents: number,
    percentageUsed: number
  ): Promise<void> {
    // Check if alert already exists for this month
    const existingQuery = `
      SELECT 1 FROM budget_alerts 
      WHERE shop_id = $1 AND alert_type = $2 AND cost_type = $3
      AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
      LIMIT 1
    `;

    try {
      const existingResult = await this.pool.query(existingQuery, [shopId, alertType, costType]);
      
      if (existingResult.rows.length > 0) {
        return; // Alert already exists for this month
      }

      // Create new alert
      const insertQuery = `
        INSERT INTO budget_alerts (
          shop_id, alert_type, cost_type, current_amount_cents, 
          budget_limit_cents, percentage_used
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;

      await this.pool.query(insertQuery, [
        shopId,
        alertType,
        costType,
        currentAmountCents,
        budgetLimitCents,
        percentageUsed,
      ]);

      this.logger.warn('Budget alert created', {
        shopId,
        alertType,
        costType,
        currentAmountCents,
        budgetLimitCents,
        percentageUsed,
      });

      // TODO: Send notification to shop managers

    } catch (error) {
      this.logger.error('Failed to create budget alert:', error);
    }
  }
}
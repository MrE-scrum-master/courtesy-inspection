// Workflow Configuration - Business Rules and State Machine Configuration
// Centralized configuration for inspection workflow management
// Customizable per shop with fallback to default rules

export interface WorkflowConfig {
  businessRules: BusinessRules;
  stateTransitions: StateTransitionRule[];
  notifications: NotificationRule[];
  validationRules: ValidationRule[];
  timeoutRules: TimeoutRule[];
}

export interface BusinessRules {
  // Timing constraints
  maxInspectionDurationMinutes: number;
  maxInProgressHours: number;
  maxPendingReviewHours: number;
  
  // Approval requirements
  requireManagerApprovalForCritical: boolean;
  requireManagerApprovalThreshold: number; // Number of critical items
  allowSelfApproval: boolean;
  
  // Quality gates
  mandatoryCategories: string[];
  minItemsRequired: number;
  requireAllItemsAssessed: boolean;
  
  // Concurrent editing
  allowConcurrentEditing: boolean;
  lockTimeoutMinutes: number;
  
  // Auto-progression rules
  autoCalculateUrgency: boolean;
  autoTransitionOnComplete: boolean;
  autoNotifyCustomer: boolean;
  
  // Cost and estimation
  requireCostEstimates: boolean;
  maxEstimateWithoutApproval: number;
  
  // Photo and voice requirements
  minPhotosPerCriticalItem: number;
  requireVoiceNotesForCritical: boolean;
}

export interface StateTransitionRule {
  fromState: string;
  toState: string;
  allowedRoles: string[];
  requiredConditions: string[];
  optionalConditions: string[];
  validationChecks: string[];
  preActions: string[];
  postActions: string[];
  autoTriggers: AutoTrigger[];
}

export interface AutoTrigger {
  condition: string;
  delayMinutes?: number;
  requiresConfirmation: boolean;
}

export interface NotificationRule {
  triggerEvent: string;
  recipients: string[]; // roles or specific users
  channels: ('email' | 'sms' | 'push' | 'in_app')[];
  template: string;
  delayMinutes?: number;
  conditions?: string[];
}

export interface ValidationRule {
  ruleName: string;
  scope: 'inspection' | 'item' | 'transition';
  conditions: string[];
  validationLogic: string;
  errorMessage: string;
  warningMessage?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface TimeoutRule {
  state: string;
  timeoutMinutes: number;
  escalationAction: string;
  notificationBeforeMinutes: number[];
  autoAction?: string;
}

// Default workflow configuration
export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  businessRules: {
    maxInspectionDurationMinutes: 120, // 2 hours
    maxInProgressHours: 4,
    maxPendingReviewHours: 24,
    
    requireManagerApprovalForCritical: true,
    requireManagerApprovalThreshold: 1,
    allowSelfApproval: false,
    
    mandatoryCategories: ['Brakes', 'Tires', 'Lights'],
    minItemsRequired: 5,
    requireAllItemsAssessed: true,
    
    allowConcurrentEditing: false,
    lockTimeoutMinutes: 15,
    
    autoCalculateUrgency: true,
    autoTransitionOnComplete: true,
    autoNotifyCustomer: true,
    
    requireCostEstimates: false,
    maxEstimateWithoutApproval: 500,
    
    minPhotosPerCriticalItem: 1,
    requireVoiceNotesForCritical: false
  },
  
  stateTransitions: [
    {
      fromState: 'draft',
      toState: 'in_progress',
      allowedRoles: ['mechanic', 'shop_manager', 'admin'],
      requiredConditions: [],
      optionalConditions: ['has_assigned_technician'],
      validationChecks: ['vehicle_available'],
      preActions: ['lock_vehicle', 'start_timer'],
      postActions: ['notify_assignment'],
      autoTriggers: []
    },
    {
      fromState: 'in_progress',
      toState: 'pending_review',
      allowedRoles: ['mechanic', 'shop_manager', 'admin'],
      requiredConditions: ['has_items', 'all_items_assessed'],
      optionalConditions: ['has_photos', 'has_voice_notes'],
      validationChecks: ['mandatory_categories', 'min_items'],
      preActions: ['calculate_urgency', 'generate_summary'],
      postActions: ['notify_managers', 'unlock_vehicle'],
      autoTriggers: [
        {
          condition: 'inspection_duration_exceeded',
          delayMinutes: 0,
          requiresConfirmation: true
        }
      ]
    },
    {
      fromState: 'pending_review',
      toState: 'approved',
      allowedRoles: ['shop_manager', 'admin'],
      requiredConditions: [],
      optionalConditions: ['manager_review_notes'],
      validationChecks: ['no_blocking_critical_items'],
      preActions: ['final_validation'],
      postActions: ['prepare_customer_report', 'notify_technician'],
      autoTriggers: [
        {
          condition: 'no_critical_items_and_auto_approve_enabled',
          delayMinutes: 30,
          requiresConfirmation: false
        }
      ]
    },
    {
      fromState: 'pending_review',
      toState: 'rejected',
      allowedRoles: ['shop_manager', 'admin'],
      requiredConditions: ['rejection_reason'],
      optionalConditions: [],
      validationChecks: [],
      preActions: ['log_rejection'],
      postActions: ['notify_technician', 'reopen_for_editing'],
      autoTriggers: []
    },
    {
      fromState: 'rejected',
      toState: 'in_progress',
      allowedRoles: ['mechanic', 'shop_manager', 'admin'],
      requiredConditions: [],
      optionalConditions: ['revision_notes'],
      validationChecks: [],
      preActions: ['clear_rejection', 'lock_vehicle'],
      postActions: ['notify_assignment'],
      autoTriggers: []
    },
    {
      fromState: 'approved',
      toState: 'sent_to_customer',
      allowedRoles: ['shop_manager', 'admin'],
      requiredConditions: ['customer_contact_info'],
      optionalConditions: [],
      validationChecks: ['sms_service_available'],
      preActions: ['generate_customer_link'],
      postActions: ['send_sms', 'log_customer_notification'],
      autoTriggers: [
        {
          condition: 'auto_notify_enabled',
          delayMinutes: 10,
          requiresConfirmation: false
        }
      ]
    },
    {
      fromState: 'sent_to_customer',
      toState: 'completed',
      allowedRoles: ['system', 'shop_manager', 'admin'],
      requiredConditions: [],
      optionalConditions: ['customer_viewed'],
      validationChecks: [],
      preActions: [],
      postActions: ['archive_inspection', 'update_customer_history'],
      autoTriggers: [
        {
          condition: 'customer_viewed_report',\n          delayMinutes: 0,\n          requiresConfirmation: false\n        },\n        {\n          condition: 'auto_complete_after_days',\n          delayMinutes: 10080, // 7 days\n          requiresConfirmation: false\n        }\n      ]\n    }\n  ],\n  \n  notifications: [\n    {\n      triggerEvent: 'inspection_assigned',\n      recipients: ['assigned_technician'],\n      channels: ['in_app', 'push'],\n      template: 'inspection_assigned',\n      conditions: ['technician_wants_notifications']\n    },\n    {\n      triggerEvent: 'inspection_submitted_for_review',\n      recipients: ['shop_manager'],\n      channels: ['in_app', 'email'],\n      template: 'inspection_ready_for_review',\n      conditions: ['has_critical_items']\n    },\n    {\n      triggerEvent: 'inspection_approved',\n      recipients: ['assigned_technician'],\n      channels: ['in_app'],\n      template: 'inspection_approved'\n    },\n    {\n      triggerEvent: 'inspection_rejected',\n      recipients: ['assigned_technician'],\n      channels: ['in_app', 'push'],\n      template: 'inspection_rejected'\n    },\n    {\n      triggerEvent: 'inspection_sent_to_customer',\n      recipients: ['customer'],\n      channels: ['sms'],\n      template: 'inspection_results_ready'\n    },\n    {\n      triggerEvent: 'inspection_overdue',\n      recipients: ['assigned_technician', 'shop_manager'],\n      channels: ['in_app', 'push'],\n      template: 'inspection_overdue',\n      conditions: ['inspection_in_progress_over_limit']\n    },\n    {\n      triggerEvent: 'critical_items_found',\n      recipients: ['shop_manager'],\n      channels: ['in_app', 'push', 'email'],\n      template: 'critical_safety_items',\n      delayMinutes: 0\n    }\n  ],\n  \n  validationRules: [\n    {\n      ruleName: 'mandatory_categories_present',\n      scope: 'inspection',\n      conditions: ['state_transition_to_pending_review'],\n      validationLogic: 'check_mandatory_categories_exist',\n      errorMessage: 'Missing mandatory inspection categories: {missing_categories}',\n      severity: 'error'\n    },\n    {\n      ruleName: 'min_items_required',\n      scope: 'inspection',\n      conditions: ['state_transition_to_pending_review'],\n      validationLogic: 'check_minimum_item_count',\n      errorMessage: 'Inspection must have at least {min_items} items',\n      severity: 'error'\n    },\n    {\n      ruleName: 'all_items_assessed',\n      scope: 'inspection',\n      conditions: ['state_transition_to_pending_review'],\n      validationLogic: 'check_all_items_have_condition',\n      errorMessage: '{unassessed_count} items missing condition assessment',\n      severity: 'error'\n    },\n    {\n      ruleName: 'critical_items_documented',\n      scope: 'item',\n      conditions: ['condition_is_needs_immediate'],\n      validationLogic: 'check_critical_item_documentation',\n      errorMessage: 'Critical safety items must have detailed notes and photos',\n      warningMessage: 'Consider adding photos and voice notes for critical items',\n      severity: 'warning'\n    },\n    {\n      ruleName: 'cost_estimate_reasonable',\n      scope: 'item',\n      conditions: ['has_cost_estimate'],\n      validationLogic: 'check_cost_estimate_range',\n      warningMessage: 'Cost estimate seems unusually high/low for this component',\n      severity: 'warning'\n    },\n    {\n      ruleName: 'measurement_values_realistic',\n      scope: 'item',\n      conditions: ['has_measurements'],\n      validationLogic: 'validate_measurement_ranges',\n      warningMessage: 'Measurement value outside typical range for this component',\n      severity: 'warning'\n    },\n    {\n      ruleName: 'odometer_progression_check',\n      scope: 'inspection',\n      conditions: ['has_odometer_reading'],\n      validationLogic: 'check_odometer_progression',\n      warningMessage: 'Odometer reading inconsistent with previous inspections',\n      severity: 'warning'\n    }\n  ],\n  \n  timeoutRules: [\n    {\n      state: 'in_progress',\n      timeoutMinutes: 240, // 4 hours\n      escalationAction: 'notify_manager',\n      notificationBeforeMinutes: [60, 15], // Warn at 1 hour and 15 minutes remaining\n      autoAction: 'flag_for_review'\n    },\n    {\n      state: 'pending_review',\n      timeoutMinutes: 1440, // 24 hours\n      escalationAction: 'escalate_to_admin',\n      notificationBeforeMinutes: [240, 60], // Warn at 4 hours and 1 hour remaining\n      autoAction: 'auto_approve_if_no_critical'\n    },\n    {\n      state: 'approved',\n      timeoutMinutes: 60, // 1 hour before auto-sending\n      escalationAction: 'auto_send_to_customer',\n      notificationBeforeMinutes: [30, 10],\n      autoAction: 'send_to_customer'\n    }\n  ]\n};\n\n// Shop-specific configuration overrides\nexport interface ShopWorkflowOverrides {\n  shopId: string;\n  businessRuleOverrides?: Partial<BusinessRules>;\n  additionalStateTransitions?: StateTransitionRule[];\n  disabledNotifications?: string[];\n  customValidationRules?: ValidationRule[];\n  customTimeoutRules?: TimeoutRule[];\n}\n\n// Configuration management functions\nexport class WorkflowConfigManager {\n  private static shopConfigs: Map<string, ShopWorkflowOverrides> = new Map();\n  \n  static getWorkflowConfig(shopId?: string): WorkflowConfig {\n    const baseConfig = { ...DEFAULT_WORKFLOW_CONFIG };\n    \n    if (!shopId) {\n      return baseConfig;\n    }\n    \n    const shopOverrides = this.shopConfigs.get(shopId);\n    if (!shopOverrides) {\n      return baseConfig;\n    }\n    \n    // Apply business rule overrides\n    if (shopOverrides.businessRuleOverrides) {\n      baseConfig.businessRules = {\n        ...baseConfig.businessRules,\n        ...shopOverrides.businessRuleOverrides\n      };\n    }\n    \n    // Add additional state transitions\n    if (shopOverrides.additionalStateTransitions) {\n      baseConfig.stateTransitions.push(...shopOverrides.additionalStateTransitions);\n    }\n    \n    // Filter out disabled notifications\n    if (shopOverrides.disabledNotifications) {\n      baseConfig.notifications = baseConfig.notifications.filter(\n        rule => !shopOverrides.disabledNotifications!.includes(rule.triggerEvent)\n      );\n    }\n    \n    // Add custom validation rules\n    if (shopOverrides.customValidationRules) {\n      baseConfig.validationRules.push(...shopOverrides.customValidationRules);\n    }\n    \n    // Override timeout rules\n    if (shopOverrides.customTimeoutRules) {\n      for (const customRule of shopOverrides.customTimeoutRules) {\n        const existingIndex = baseConfig.timeoutRules.findIndex(\n          rule => rule.state === customRule.state\n        );\n        \n        if (existingIndex >= 0) {\n          baseConfig.timeoutRules[existingIndex] = customRule;\n        } else {\n          baseConfig.timeoutRules.push(customRule);\n        }\n      }\n    }\n    \n    return baseConfig;\n  }\n  \n  static setShopConfig(shopId: string, config: ShopWorkflowOverrides): void {\n    this.shopConfigs.set(shopId, config);\n  }\n  \n  static removeShopConfig(shopId: string): void {\n    this.shopConfigs.delete(shopId);\n  }\n  \n  static getShopConfig(shopId: string): ShopWorkflowOverrides | undefined {\n    return this.shopConfigs.get(shopId);\n  }\n  \n  // Load shop configurations from database\n  static async loadShopConfigurations(db: any): Promise<void> {\n    try {\n      const result = await db.query(`\n        SELECT shop_id, business_rules, state_transitions, \n               notifications, validation_rules, timeout_rules\n        FROM shop_workflow_configs\n        WHERE is_active = true\n      `);\n      \n      for (const row of result.rows) {\n        const config: ShopWorkflowOverrides = {\n          shopId: row.shop_id,\n          businessRuleOverrides: row.business_rules ? JSON.parse(row.business_rules) : undefined,\n          additionalStateTransitions: row.state_transitions ? JSON.parse(row.state_transitions) : undefined,\n          disabledNotifications: row.notifications ? JSON.parse(row.notifications).disabled : undefined,\n          customValidationRules: row.validation_rules ? JSON.parse(row.validation_rules) : undefined,\n          customTimeoutRules: row.timeout_rules ? JSON.parse(row.timeout_rules) : undefined\n        };\n        \n        this.setShopConfig(row.shop_id, config);\n      }\n      \n      console.log(`Loaded workflow configurations for ${result.rows.length} shops`);\n    } catch (error) {\n      console.error('Failed to load shop workflow configurations:', error);\n    }\n  }\n  \n  // Save shop configuration to database\n  static async saveShopConfiguration(\n    db: any, \n    shopId: string, \n    config: ShopWorkflowOverrides\n  ): Promise<void> {\n    try {\n      await db.query(`\n        INSERT INTO shop_workflow_configs (\n          shop_id, business_rules, state_transitions,\n          notifications, validation_rules, timeout_rules,\n          is_active, created_at, updated_at\n        )\n        VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())\n        ON CONFLICT (shop_id)\n        DO UPDATE SET\n          business_rules = EXCLUDED.business_rules,\n          state_transitions = EXCLUDED.state_transitions,\n          notifications = EXCLUDED.notifications,\n          validation_rules = EXCLUDED.validation_rules,\n          timeout_rules = EXCLUDED.timeout_rules,\n          updated_at = NOW()\n      `, [\n        shopId,\n        config.businessRuleOverrides ? JSON.stringify(config.businessRuleOverrides) : null,\n        config.additionalStateTransitions ? JSON.stringify(config.additionalStateTransitions) : null,\n        config.disabledNotifications ? JSON.stringify({ disabled: config.disabledNotifications }) : null,\n        config.customValidationRules ? JSON.stringify(config.customValidationRules) : null,\n        config.customTimeoutRules ? JSON.stringify(config.customTimeoutRules) : null\n      ]);\n      \n      this.setShopConfig(shopId, config);\n    } catch (error) {\n      console.error('Failed to save shop workflow configuration:', error);\n      throw error;\n    }\n  }\n}\n\n// Validation functions for configuration\nexport function validateWorkflowConfig(config: WorkflowConfig): { valid: boolean; errors: string[] } {\n  const errors: string[] = [];\n  \n  // Validate business rules\n  if (config.businessRules.maxInspectionDurationMinutes <= 0) {\n    errors.push('Max inspection duration must be positive');\n  }\n  \n  if (config.businessRules.maxInProgressHours <= 0) {\n    errors.push('Max in-progress hours must be positive');\n  }\n  \n  if (config.businessRules.minItemsRequired < 0) {\n    errors.push('Min items required cannot be negative');\n  }\n  \n  // Validate state transitions\n  const states = new Set<string>();\n  for (const transition of config.stateTransitions) {\n    states.add(transition.fromState);\n    states.add(transition.toState);\n    \n    if (transition.allowedRoles.length === 0) {\n      errors.push(`State transition from ${transition.fromState} to ${transition.toState} has no allowed roles`);\n    }\n  }\n  \n  // Check for required states\n  const requiredStates = ['draft', 'in_progress', 'pending_review', 'approved', 'sent_to_customer', 'completed'];\n  for (const requiredState of requiredStates) {\n    if (!states.has(requiredState)) {\n      errors.push(`Missing required state: ${requiredState}`);\n    }\n  }\n  \n  // Validate timeout rules\n  for (const timeoutRule of config.timeoutRules) {\n    if (timeoutRule.timeoutMinutes <= 0) {\n      errors.push(`Timeout rule for state ${timeoutRule.state} has invalid timeout`);\n    }\n  }\n  \n  return {\n    valid: errors.length === 0,\n    errors\n  };\n}\n\n// Helper functions for common workflow operations\nexport class WorkflowHelpers {\n  static getValidTransitions(fromState: string, userRole: string, shopId?: string): string[] {\n    const config = WorkflowConfigManager.getWorkflowConfig(shopId);\n    \n    return config.stateTransitions\n      .filter(t => t.fromState === fromState && t.allowedRoles.includes(userRole))\n      .map(t => t.toState);\n  }\n  \n  static getNotificationRecipientsForEvent(\n    event: string, \n    context: any, \n    shopId?: string\n  ): { recipients: string[]; channels: string[]; template: string }[] {\n    const config = WorkflowConfigManager.getWorkflowConfig(shopId);\n    \n    return config.notifications\n      .filter(n => n.triggerEvent === event)\n      .filter(n => !n.conditions || this.evaluateConditions(n.conditions, context))\n      .map(n => ({\n        recipients: n.recipients,\n        channels: n.channels,\n        template: n.template\n      }));\n  }\n  \n  static getValidationRulesForScope(\n    scope: 'inspection' | 'item' | 'transition',\n    context: any,\n    shopId?: string\n  ): ValidationRule[] {\n    const config = WorkflowConfigManager.getWorkflowConfig(shopId);\n    \n    return config.validationRules\n      .filter(r => r.scope === scope)\n      .filter(r => this.evaluateConditions(r.conditions, context));\n  }\n  \n  static getTimeoutRuleForState(state: string, shopId?: string): TimeoutRule | undefined {\n    const config = WorkflowConfigManager.getWorkflowConfig(shopId);\n    return config.timeoutRules.find(r => r.state === state);\n  }\n  \n  private static evaluateConditions(conditions: string[], context: any): boolean {\n    // Simplified condition evaluation\n    // In a real implementation, this would be more sophisticated\n    for (const condition of conditions) {\n      if (!this.evaluateCondition(condition, context)) {\n        return false;\n      }\n    }\n    return true;\n  }\n  \n  private static evaluateCondition(condition: string, context: any): boolean {\n    // Basic condition evaluation logic\n    // This would be expanded based on actual condition syntax\n    switch (condition) {\n      case 'has_critical_items':\n        return context.criticalItemCount > 0;\n      case 'technician_wants_notifications':\n        return context.technicianPreferences?.notifications !== false;\n      case 'inspection_in_progress_over_limit':\n        return context.durationMinutes > 240;\n      case 'auto_notify_enabled':\n        return context.shopSettings?.autoNotifyCustomer !== false;\n      default:\n        return true;\n    }\n  }\n}
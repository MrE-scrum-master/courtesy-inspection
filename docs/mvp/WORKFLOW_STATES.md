# WORKFLOW_STATES.md - Courtesy Inspection State Management

## Overview

This document defines the state management system for courtesy inspections, covering the complete workflow from Shop Manager creation through customer delivery.

**Key Permission Changes:**
- **Shop Manager**: Creates inspections, assigns to Mechanics, reviews/approves, sends SMS to customers
- **Mechanic**: Executes assigned inspections, cannot send SMS 
- **Super Admin**: Override permissions on all states and actions
- **SMS Restriction**: Only Shop Managers and Super Admins can send SMS messages to customers

## State Definitions

### Primary States

#### `AWAITING_SERVICE`
- **Purpose**: Initial state when customer arrives for service
- **Owner**: Shop Manager or Mechanic (when assigned)
- **Description**: Inspection has been created by Shop Manager but physical inspection not yet completed
- **Duration**: Typically 15-60 minutes depending on service complexity
- **Indicators**: 
  - Vehicle checked in
  - Customer information captured
  - Inspection template selected
  - Mechanic assigned (if delegated)

#### `AWAITING_REVIEW`
- **Purpose**: Inspection completed, pending Shop Manager review
- **Owner**: Shop Manager
- **Description**: Mechanic has completed inspection, ready for quality review and customer-facing edits
- **Duration**: Typically 5-30 minutes
- **Indicators**:
  - All inspection items completed
  - Photos uploaded
  - Initial findings documented

#### `READY_TO_SEND`
- **Purpose**: Inspection approved and ready for customer delivery
- **Owner**: Shop Manager or System (automation)
- **Description**: Final review completed, formatted for customer consumption
- **Duration**: 0-15 minutes (automated) or until manual send
- **Indicators**:
  - Shop Manager approval complete
  - Customer communication preferences confirmed
  - Content finalized for delivery

#### `SENT`
- **Purpose**: Inspection delivered to customer
- **Owner**: System
- **Description**: Final state indicating successful delivery to customer
- **Duration**: Permanent (with timestamp)
- **Indicators**:
  - Delivery confirmation received
  - Customer notified via preferred method
  - Two-way communication channel activated

### Error States

#### `ERROR_INCOMPLETE`
- **Purpose**: Inspection cannot progress due to missing required information
- **Recovery**: Complete missing fields → return to previous valid state
- **Triggers**: Missing required photos, incomplete inspection items, missing customer contact

#### `ERROR_SEND_FAILED`
- **Purpose**: Delivery attempt failed
- **Recovery**: Retry delivery or manual intervention
- **Triggers**: Invalid contact information, service outage, customer opt-out

#### `ERROR_TECHNICAL`
- **Purpose**: System error preventing state progression
- **Recovery**: Technical resolution required, maintain data integrity
- **Triggers**: Database errors, service failures, data corruption

## State Transition Rules

### Valid Transitions

```typescript
const VALID_TRANSITIONS = {
  AWAITING_SERVICE: ['AWAITING_REVIEW', 'ERROR_INCOMPLETE'],
  AWAITING_REVIEW: ['READY_TO_SEND', 'AWAITING_SERVICE', 'ERROR_INCOMPLETE'],
  READY_TO_SEND: ['SENT', 'AWAITING_REVIEW', 'ERROR_SEND_FAILED'],
  SENT: [], // Terminal state
  ERROR_INCOMPLETE: ['AWAITING_SERVICE', 'AWAITING_REVIEW'],
  ERROR_SEND_FAILED: ['READY_TO_SEND', 'ERROR_TECHNICAL'],
  ERROR_TECHNICAL: ['AWAITING_SERVICE', 'AWAITING_REVIEW', 'READY_TO_SEND']
} as const;
```

### Transition Conditions

#### `AWAITING_SERVICE → AWAITING_REVIEW`
**Required Conditions:**
- All mandatory inspection items completed
- At least one photo per required category
- Mechanic signature/confirmation
- No critical safety items left unaddressed

**Validation:**
```typescript
interface CompletionValidation {
  allItemsCompleted: boolean;
  requiredPhotosPresent: boolean;
  mechanicConfirmation: boolean;
  criticalIssuesAddressed: boolean;
}
```

#### `AWAITING_REVIEW → READY_TO_SEND`
**Required Conditions:**
- Shop Manager review completed
- Customer communication preferences confirmed
- Any edits/corrections applied
- Final approval given

#### `READY_TO_SEND → SENT`
**Required Conditions:**
- Valid customer contact information
- Delivery method selected and available
- No customer communication blocks
- System confirmation of successful delivery

## Permission Model

### Role Hierarchy and Definitions

#### Role Definitions

**Shop Manager**
- Creates new inspections (AWAITING_SERVICE state)
- Assigns inspections to Mechanics or executes them personally (hybrid role)
- Reviews completed inspections (AWAITING_REVIEW → READY_TO_SEND)
- Approves and sends inspections to customers
- **Exclusive SMS Permission**: Only Shop Managers can send SMS messages to customers
- Has override capabilities for most workflow states

**Mechanic**
- Receives assigned inspections from Shop Manager
- Executes physical inspections (AWAITING_SERVICE → AWAITING_REVIEW)
- Cannot send SMS messages to customers
- Read-only access to inspections after completion

**Super Admin**
- Full override permissions on all workflow states
- Can edit and transition any inspection at any time
- Can send SMS messages to customers
- System administration and emergency recovery capabilities

**System**
- Automated processes and transitions
- Auto-send functionality for approved inspections
- Error handling and recovery processes

#### Workflow Hierarchy

1. **Shop Manager creates inspection** → AWAITING_SERVICE
2. **Shop Manager assigns to Mechanic OR executes personally**
3. **Mechanic/Shop Manager completes inspection** → AWAITING_REVIEW
4. **Shop Manager reviews and approves** → READY_TO_SEND
5. **Shop Manager sends to customer OR system auto-sends** → SENT

### Role-Based Access Control

```typescript
enum UserRole {
  MECHANIC = 'mechanic',
  SHOP_MANAGER = 'shop_manager',
  SUPER_ADMIN = 'super_admin',
  SYSTEM = 'system'
}

interface StatePermissions {
  canView: UserRole[];
  canEdit: UserRole[];
  canTransition: UserRole[];
  canSendSMS: UserRole[];
}

const STATE_PERMISSIONS: Record<WorkflowState, StatePermissions> = {
  AWAITING_SERVICE: {
    canView: [UserRole.MECHANIC, UserRole.SHOP_MANAGER, UserRole.SUPER_ADMIN],
    canEdit: [UserRole.MECHANIC, UserRole.SHOP_MANAGER], // Shop Manager can do hybrid role
    canTransition: [UserRole.MECHANIC, UserRole.SHOP_MANAGER, UserRole.SUPER_ADMIN],
    canSendSMS: [UserRole.SHOP_MANAGER, UserRole.SUPER_ADMIN]
  },
  AWAITING_REVIEW: {
    canView: [UserRole.MECHANIC, UserRole.SHOP_MANAGER, UserRole.SUPER_ADMIN],
    canEdit: [UserRole.SHOP_MANAGER, UserRole.SUPER_ADMIN],
    canTransition: [UserRole.SHOP_MANAGER, UserRole.SUPER_ADMIN],
    canSendSMS: [UserRole.SHOP_MANAGER, UserRole.SUPER_ADMIN]
  },
  READY_TO_SEND: {
    canView: [UserRole.SHOP_MANAGER, UserRole.SUPER_ADMIN],
    canEdit: [UserRole.SHOP_MANAGER, UserRole.SUPER_ADMIN],
    canTransition: [UserRole.SHOP_MANAGER, UserRole.SUPER_ADMIN, UserRole.SYSTEM],
    canSendSMS: [UserRole.SHOP_MANAGER, UserRole.SUPER_ADMIN]
  },
  SENT: {
    canView: [UserRole.SHOP_MANAGER, UserRole.SUPER_ADMIN],
    canEdit: [UserRole.SUPER_ADMIN], // Only Super Admin can edit sent inspections
    canTransition: [UserRole.SUPER_ADMIN], // Only Super Admin can override sent state
    canSendSMS: [UserRole.SHOP_MANAGER, UserRole.SUPER_ADMIN]
  }
};
```

### Permission Validation

```typescript
function canUserTransitionState(
  userId: string,
  currentState: WorkflowState,
  targetState: WorkflowState
): boolean {
  const user = getUserById(userId);
  const permissions = STATE_PERMISSIONS[currentState];
  const validTransitions = VALID_TRANSITIONS[currentState];
  
  return (
    permissions.canTransition.includes(user.role) &&
    validTransitions.includes(targetState)
  );
}

function canUserSendSMS(
  userId: string,
  currentState: WorkflowState
): boolean {
  const user = getUserById(userId);
  const permissions = STATE_PERMISSIONS[currentState];
  
  return permissions.canSendSMS.includes(user.role);
}

function canUserEditInspection(
  userId: string,
  currentState: WorkflowState
): boolean {
  const user = getUserById(userId);
  const permissions = STATE_PERMISSIONS[currentState];
  
  // Super Admin has override permissions
  if (user.role === UserRole.SUPER_ADMIN) {
    return true;
  }
  
  return permissions.canEdit.includes(user.role);
}
```

## Automation Rules

### Auto-Send Conditions

The system can automatically transition from `READY_TO_SEND` to `SENT` when:

1. **Time-Based Triggers**
   - Immediate send (0 delay) for premium customers
   - 5-minute delay for standard customers (allows manual review)
   - Business hours only for non-urgent items

2. **Customer Preference Triggers**
   - Customer has opted for immediate notifications
   - Preferred communication method is available
   - No "do not disturb" flags set

3. **Business Logic Triggers**
   - No critical safety issues requiring immediate attention
   - Shop Manager hasn't flagged for manual review
   - Customer has active service appointment

```typescript
interface AutoSendConfig {
  immediateCustomers: string[]; // Customer IDs for immediate send
  standardDelayMinutes: number; // Default delay for standard customers
  businessHoursOnly: boolean; // Restrict to business hours
  requiresShopManagerApproval: (inspection: Inspection) => boolean;
}

async function shouldAutoSend(inspection: Inspection): Promise<boolean> {
  const customer = await getCustomerById(inspection.customerId);
  const config = await getAutoSendConfig();
  
  // Check customer preferences
  if (!customer.autoNotificationEnabled) return false;
  
  // Check critical issues
  if (inspection.hasCriticalSafetyIssues) return false;
  
  // Check shop manager flags
  if (inspection.requiresManualReview) return false;
  
  // Check business hours if required
  if (config.businessHoursOnly && !isBusinessHours()) return false;
  
  return true;
}
```

## Notification Triggers

### SMS Notifications

```typescript
interface SMSNotification {
  trigger: WorkflowState;
  template: string;
  conditions: (inspection: Inspection) => boolean;
}

const SMS_TRIGGERS: SMSNotification[] = [
  {
    trigger: 'SENT',
    template: 'INSPECTION_COMPLETE',
    conditions: (inspection) => inspection.customer.prefersSMS
  },
  {
    trigger: 'READY_TO_SEND',
    template: 'INSPECTION_READY_URGENT',
    conditions: (inspection) => inspection.hasCriticalSafetyIssues
  }
];
```

### Email Notifications

```typescript
const EMAIL_TRIGGERS = [
  {
    trigger: 'SENT',
    template: 'INSPECTION_REPORT_DETAILED',
    conditions: (inspection: Inspection) => inspection.customer.prefersEmail
  },
  {
    trigger: 'AWAITING_REVIEW',
    template: 'SHOP_MANAGER_REVIEW_NEEDED',
    recipients: 'SHOP_MANAGERS'
  }
];
```

### In-App Notifications

```typescript
const IN_APP_TRIGGERS = [
  {
    trigger: 'AWAITING_SERVICE',
    message: 'New inspection assigned',
    recipients: 'ASSIGNED_MECHANIC'
  },
  {
    trigger: 'AWAITING_REVIEW',
    message: 'Inspection ready for review',
    recipients: 'SHOP_MANAGERS'
  }
];
```

## Error Handling and Recovery

### Automatic Recovery

```typescript
interface RecoveryStrategy {
  errorState: WorkflowState;
  maxRetries: number;
  retryDelaySeconds: number;
  recoveryAction: (inspection: Inspection) => Promise<void>;
}

const RECOVERY_STRATEGIES: RecoveryStrategy[] = [
  {
    errorState: 'ERROR_SEND_FAILED',
    maxRetries: 3,
    retryDelaySeconds: 300, // 5 minutes
    recoveryAction: async (inspection) => {
      await validateCustomerContact(inspection.customerId);
      await retrySendInspection(inspection.id);
    }
  },
  {
    errorState: 'ERROR_INCOMPLETE',
    maxRetries: 0, // Manual intervention required
    retryDelaySeconds: 0,
    recoveryAction: async (inspection) => {
      await notifyMechanic(inspection.mechanicId, 'COMPLETION_REQUIRED');
    }
  }
];
```

### Manual Recovery

```typescript
interface ManualRecoveryAction {
  name: string;
  description: string;
  requiredRole: UserRole;
  action: (inspectionId: string, userId: string) => Promise<void>;
}

const MANUAL_RECOVERY_ACTIONS: ManualRecoveryAction[] = [
  {
    name: 'force_send',
    description: 'Force send inspection despite delivery issues',
    requiredRole: UserRole.SUPER_ADMIN,
    action: async (inspectionId, userId) => {
      await forceTransitionState(inspectionId, 'SENT', userId);
      await logManualOverride(inspectionId, userId, 'FORCE_SEND');
    }
  },
  {
    name: 'reset_to_review',
    description: 'Reset inspection back to review state',
    requiredRole: UserRole.SHOP_MANAGER,
    action: async (inspectionId, userId) => {
      await transitionState(inspectionId, 'AWAITING_REVIEW', userId);
      await logManualOverride(inspectionId, userId, 'RESET_TO_REVIEW');
    }
  }
];
```

## Audit Logging

### Required Audit Events

```typescript
interface AuditEvent {
  id: string;
  inspectionId: string;
  userId: string;
  timestamp: Date;
  eventType: AuditEventType;
  fromState?: WorkflowState;
  toState: WorkflowState;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

enum AuditEventType {
  STATE_TRANSITION = 'state_transition',
  MANUAL_OVERRIDE = 'manual_override',
  AUTO_TRANSITION = 'auto_transition',
  ERROR_OCCURRED = 'error_occurred',
  RECOVERY_ATTEMPTED = 'recovery_attempted'
}
```

### Audit Implementation

```typescript
class InspectionAuditLogger {
  async logStateTransition(
    inspectionId: string,
    fromState: WorkflowState,
    toState: WorkflowState,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: AuditEvent = {
      id: generateUUID(),
      inspectionId,
      userId,
      timestamp: new Date(),
      eventType: AuditEventType.STATE_TRANSITION,
      fromState,
      toState,
      metadata: metadata || {}
    };
    
    await this.persistAuditEvent(event);
    await this.triggerRealTimeNotifications(event);
  }
  
  async logError(
    inspectionId: string,
    errorState: WorkflowState,
    error: Error,
    userId?: string
  ): Promise<void> {
    const event: AuditEvent = {
      id: generateUUID(),
      inspectionId,
      userId: userId || 'system',
      timestamp: new Date(),
      eventType: AuditEventType.ERROR_OCCURRED,
      toState: errorState,
      metadata: {
        errorMessage: error.message,
        errorStack: error.stack
      }
    };
    
    await this.persistAuditEvent(event);
    await this.alertErrorMonitoring(event);
  }
}
```

## State Persistence Strategy

### Database Schema

```sql
-- Main inspection states table
CREATE TABLE inspection_states (
  inspection_id UUID PRIMARY KEY,
  current_state VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_by UUID NOT NULL,
  metadata JSONB,
  
  CONSTRAINT fk_inspection_states_inspection 
    FOREIGN KEY (inspection_id) REFERENCES inspections(id),
  CONSTRAINT fk_inspection_states_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_inspection_states_updated_by 
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- State transition history
CREATE TABLE state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL,
  from_state VARCHAR(50),
  to_state VARCHAR(50) NOT NULL,
  transitioned_by UUID NOT NULL,
  transitioned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reason VARCHAR(255),
  metadata JSONB,
  
  CONSTRAINT fk_state_transitions_inspection 
    FOREIGN KEY (inspection_id) REFERENCES inspections(id),
  CONSTRAINT fk_state_transitions_user 
    FOREIGN KEY (transitioned_by) REFERENCES users(id)
);

-- Automation rules configuration
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name VARCHAR(100) NOT NULL,
  from_state VARCHAR(50) NOT NULL,
  to_state VARCHAR(50) NOT NULL,
  conditions JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### State Machine Implementation

```typescript
interface StateTransitionContext {
  inspection: Inspection;
  user: User;
  reason?: string;
  metadata?: Record<string, any>;
}

class InspectionStateMachine {
  private auditLogger: InspectionAuditLogger;
  private notificationService: NotificationService;
  
  constructor() {
    this.auditLogger = new InspectionAuditLogger();
    this.notificationService = new NotificationService();
  }
  
  async transitionState(
    inspectionId: string,
    targetState: WorkflowState,
    context: StateTransitionContext
  ): Promise<void> {
    const inspection = await this.getInspection(inspectionId);
    const currentState = inspection.currentState;
    
    // Validate transition
    await this.validateTransition(currentState, targetState, context.user);
    
    // Execute pre-transition hooks
    await this.executePreTransitionHooks(inspection, targetState, context);
    
    // Perform state transition
    await this.updateInspectionState(inspectionId, targetState, context.user);
    
    // Execute post-transition hooks
    await this.executePostTransitionHooks(inspection, currentState, targetState, context);
    
    // Log the transition
    await this.auditLogger.logStateTransition(
      inspectionId,
      currentState,
      targetState,
      context.user.id,
      context.metadata
    );
  }
  
  private async validateTransition(
    fromState: WorkflowState,
    toState: WorkflowState,
    user: User
  ): Promise<void> {
    // Check if transition is valid
    if (!VALID_TRANSITIONS[fromState].includes(toState)) {
      throw new InvalidTransitionError(`Cannot transition from ${fromState} to ${toState}`);
    }
    
    // Check user permissions
    if (!canUserTransitionState(user.id, fromState, toState)) {
      throw new InsufficientPermissionsError(`User ${user.id} cannot transition from ${fromState} to ${toState}`);
    }
  }
  
  private async executePostTransitionHooks(
    inspection: Inspection,
    fromState: WorkflowState,
    toState: WorkflowState,
    context: StateTransitionContext
  ): Promise<void> {
    // Trigger notifications
    await this.notificationService.triggerStateNotifications(inspection, toState);
    
    // Check for automation opportunities
    if (toState === 'READY_TO_SEND') {
      const shouldAuto = await shouldAutoSend(inspection);
      if (shouldAuto) {
        setTimeout(() => {
          this.transitionState(inspection.id, 'SENT', {
            inspection,
            user: { id: 'system', role: UserRole.SYSTEM } as User,
            reason: 'Automated send after delay'
          });
        }, 5 * 60 * 1000); // 5-minute delay
      }
    }
  }
}
```

## UI/UX Implications

### State-Specific UI Behaviors

#### `AWAITING_SERVICE`
- **Mechanic Interface**: Full edit capabilities, inspection checklist, photo upload
- **Shop Manager Interface**: Full edit capabilities (hybrid role) or read-only view when assigned to Mechanic
- **Indicators**: Blue progress bar, "In Progress" badge
- **Actions**: "Complete Inspection" button (Mechanic or Shop Manager only)

#### `AWAITING_REVIEW`
- **Mechanic Interface**: Read-only view of completed inspection
- **Shop Manager Interface**: Edit mode, customer-facing text editing, approval controls
- **Indicators**: Orange "Pending Review" badge, estimated review time
- **Actions**: "Approve & Send" button, "Return to Mechanic" button

#### `READY_TO_SEND`
- **Shop Manager Interface**: Final preview, send options, scheduling controls, SMS send capabilities
- **Indicators**: Green "Ready" badge, countdown timer for auto-send
- **Actions**: "Send SMS Now" button, "Schedule Send" button, "Edit" button

#### `SENT`
- **Shop Manager**: Read-only view, delivery confirmation, customer response tracking
- **Super Admin**: Full access with edit capabilities for emergency situations
- **Indicators**: Green "Sent" badge with timestamp, delivery status
- **Actions**: "View Customer Response" link, "Resend SMS" button (Shop Manager/Super Admin only)

### Progressive Disclosure

```typescript
interface StateUIConfig {
  visibleSections: string[];
  editableSections: string[];
  availableActions: string[];
  requiredFields: string[];
}

const STATE_UI_CONFIG: Record<WorkflowState, StateUIConfig> = {
  AWAITING_SERVICE: {
    visibleSections: ['inspection_items', 'photos', 'notes'],
    editableSections: ['inspection_items', 'photos', 'notes'],
    availableActions: ['complete_inspection', 'save_draft'],
    requiredFields: ['inspection_items', 'mechanic_signature']
  },
  AWAITING_REVIEW: {
    visibleSections: ['inspection_items', 'photos', 'notes', 'customer_summary'],
    editableSections: ['customer_summary', 'recommendations'],
    availableActions: ['approve_and_send', 'return_to_mechanic', 'save_changes'],
    requiredFields: ['shop_manager_approval']
  },
  // ... other states
};
```

## Integration with Two-Way Texting

### Message State Correlation

```typescript
interface TextMessage {
  id: string;
  inspectionId: string;
  customerId: string;
  direction: 'inbound' | 'outbound';
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

class TextingIntegration {
  async sendInspectionReport(inspection: Inspection): Promise<void> {
    const message = await this.formatInspectionMessage(inspection);
    
    try {
      await this.smsService.sendMessage({
        to: inspection.customer.phone,
        message: message.content,
        attachments: message.attachments
      });
      
      // Update inspection state to SENT
      await this.stateMachine.transitionState(inspection.id, 'SENT', {
        inspection,
        user: { id: 'system', role: UserRole.SYSTEM } as User,
        reason: 'Automated SMS delivery'
      });
      
    } catch (error) {
      // Transition to error state
      await this.stateMachine.transitionState(inspection.id, 'ERROR_SEND_FAILED', {
        inspection,
        user: { id: 'system', role: UserRole.SYSTEM } as User,
        reason: `SMS delivery failed: ${error.message}`
      });
    }
  }
  
  async handleCustomerResponse(message: TextMessage): Promise<void> {
    const inspection = await this.getInspectionById(message.inspectionId);
    
    // Only process responses for sent inspections
    if (inspection.currentState !== 'SENT') {
      return;
    }
    
    // Parse customer response for intent (questions, approval, scheduling)
    const intent = await this.parseCustomerIntent(message.content);
    
    // Route to appropriate handler
    switch (intent.type) {
      case 'question':
        await this.notifyShopManager(inspection, message);
        break;
      case 'approval':
        await this.processServiceApproval(inspection, intent.approvedItems);
        break;
      case 'scheduling':
        await this.initiateSchedulingFlow(inspection, intent.preferences);
        break;
    }
  }
}
```

## Performance Considerations

### State Query Optimization

```sql
-- Index for state-based queries
CREATE INDEX idx_inspection_states_current_state ON inspection_states(current_state);
CREATE INDEX idx_inspection_states_updated_at ON inspection_states(updated_at);

-- Composite index for dashboard queries
CREATE INDEX idx_inspection_states_state_user ON inspection_states(current_state, updated_by, updated_at);
```

### Caching Strategy

```typescript
class StateCache {
  private redis: RedisClient;
  
  async getCachedState(inspectionId: string): Promise<WorkflowState | null> {
    const cached = await this.redis.get(`inspection:${inspectionId}:state`);
    return cached as WorkflowState | null;
  }
  
  async setCachedState(inspectionId: string, state: WorkflowState): Promise<void> {
    await this.redis.setex(`inspection:${inspectionId}:state`, 3600, state);
  }
  
  async invalidateCache(inspectionId: string): Promise<void> {
    await this.redis.del(`inspection:${inspectionId}:state`);
  }
}
```

## Monitoring and Metrics

### Key Performance Indicators

```typescript
interface StateMetrics {
  averageTimeInState: Record<WorkflowState, number>; // milliseconds
  transitionSuccessRate: Record<string, number>; // percentage
  errorRecoveryRate: Record<WorkflowState, number>; // percentage
  automationEffectiveness: number; // percentage of auto-sends
}

class StateMetricsCollector {
  async collectDailyMetrics(): Promise<StateMetrics> {
    const metrics = await this.database.query(`
      SELECT 
        from_state,
        to_state,
        AVG(EXTRACT(EPOCH FROM (transitioned_at - created_at))) as avg_duration,
        COUNT(*) as transition_count,
        SUM(CASE WHEN to_state LIKE 'ERROR_%' THEN 1 ELSE 0 END) as error_count
      FROM state_transitions 
      WHERE transitioned_at >= NOW() - INTERVAL '24 hours'
      GROUP BY from_state, to_state
    `);
    
    return this.processMetrics(metrics);
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('InspectionStateMachine', () => {
  let stateMachine: InspectionStateMachine;
  let mockInspection: Inspection;
  
  beforeEach(() => {
    stateMachine = new InspectionStateMachine();
    mockInspection = createMockInspection();
  });
  
  describe('transitionState', () => {
    it('should successfully transition from AWAITING_SERVICE to AWAITING_REVIEW', async () => {
      await stateMachine.transitionState(mockInspection.id, 'AWAITING_REVIEW', {
        inspection: mockInspection,
        user: createMockMechanic(),
        reason: 'Inspection completed'
      });
      
      const updatedInspection = await getInspectionById(mockInspection.id);
      expect(updatedInspection.currentState).toBe('AWAITING_REVIEW');
    });
    
    it('should reject invalid transitions', async () => {
      await expect(
        stateMachine.transitionState(mockInspection.id, 'SENT', {
          inspection: mockInspection,
          user: createMockMechanic()
        })
      ).rejects.toThrow(InvalidTransitionError);
    });
  });
});
```

### Integration Tests

```typescript
describe('End-to-End Workflow', () => {
  it('should complete full inspection workflow', async () => {
    // Create inspection
    const inspection = await createInspection({
      customerId: 'test-customer',
      mechanicId: 'test-mechanic'
    });
    
    expect(inspection.currentState).toBe('AWAITING_SERVICE');
    
    // Complete inspection
    await completeInspection(inspection.id);
    const afterComplete = await getInspectionById(inspection.id);
    expect(afterComplete.currentState).toBe('AWAITING_REVIEW');
    
    // Approve and send
    await approveInspection(inspection.id, 'test-shop-manager');
    const afterApproval = await getInspectionById(inspection.id);
    expect(afterApproval.currentState).toBe('READY_TO_SEND');
    
    // Auto-send should trigger
    await wait(6000); // Wait for auto-send delay
    const final = await getInspectionById(inspection.id);
    expect(final.currentState).toBe('SENT');
  });
});
```

---

This specification provides a comprehensive foundation for implementing the workflow state management system in the Courtesy Inspection project. The TypeScript code examples can be adapted to your specific framework and database choices while maintaining the core state management principles outlined here.
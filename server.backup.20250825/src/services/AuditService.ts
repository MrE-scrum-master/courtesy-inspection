// Audit Service - Comprehensive security and activity logging
// Tracks all system activities, security events, and compliance requirements

import { DatabaseService, RequestUser } from '../types/common';
import crypto from 'crypto';

export interface AuditLogEntry {
  id?: string;
  correlationId?: string;
  userId?: string;
  shopId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number;
  errorMessage?: string;
  requestData?: any;
  responseData?: any;
  executionTimeMs?: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'auth' | 'data' | 'security' | 'system' | 'api' | 'user_action';
  createdAt?: Date;
}

export interface SecurityEvent {
  type: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'PASSWORD_CHANGE' | 'ACCOUNT_LOCKED' | 
        'PERMISSION_DENIED' | 'SUSPICIOUS_ACTIVITY' | 'DATA_ACCESS' | 'SYSTEM_ERROR';
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AuditQuery {
  userId?: string;
  shopId?: string;
  action?: string;
  resource?: string;
  category?: string;
  severity?: string;
  ipAddress?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditStatistics {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  topUsers: Array<{ userId: string; email: string; count: number }>;
  topIpAddresses: Array<{ ipAddress: string; count: number }>;
  recentSecurityEvents: AuditLogEntry[];
  systemHealth: {
    errorRate: number;
    averageResponseTime: number;
    failedLogins: number;
    suspiciousActivities: number;
  };
}

export class AuditService {
  private db: DatabaseService;
  private batchSize: number = 100;
  private batchQueue: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(db: DatabaseService) {
    this.db = db;
    this.startBatchProcessor();
  }

  // Log general audit event
  async logEvent(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        ...entry,
        correlationId: entry.correlationId || crypto.randomUUID(),
        createdAt: new Date()
      };

      // Add to batch queue for performance
      this.batchQueue.push(auditEntry);

      // Flush immediately for critical events
      if (entry.severity === 'critical' || entry.category === 'security') {
        await this.flushBatch();
      }

    } catch (error) {
      console.error('Failed to queue audit log:', error);
    }
  }

  // Log security-specific events
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const auditEntry: Omit<AuditLogEntry, 'id' | 'createdAt'> = {
      action: `SECURITY_${event.type}`,
      resource: 'security',
      userId: event.userId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      requestData: event.details,
      severity: this.mapSecuritySeverity(event.severity),
      category: 'security'
    };

    await this.logEvent(auditEntry);

    // Real-time alerting for critical security events
    if (event.severity === 'critical') {
      await this.triggerSecurityAlert(event);
    }
  }

  // Log API request/response
  async logApiAccess(req: any, res: any, executionTime: number, user?: RequestUser): Promise<void> {
    try {
      const statusCode = res.statusCode || 200;
      const severity = this.getHttpSeverity(statusCode);

      const auditEntry: Omit<AuditLogEntry, 'id' | 'createdAt'> = {
        correlationId: req.correlationId,
        userId: user?.id,
        shopId: user?.shop_id,
        action: `${req.method}_${req.route?.path || req.path}`,
        resource: 'api',
        resourceId: req.params?.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode,
        requestData: this.sanitizeRequestData(req),
        responseData: this.sanitizeResponseData(res),
        executionTimeMs: executionTime,
        severity,
        category: 'api'
      };

      await this.logEvent(auditEntry);

    } catch (error) {
      console.error('Failed to log API access:', error);
    }
  }

  // Log data access/modification
  async logDataAccess(
    action: string,
    resource: string,
    resourceId: string,
    user?: RequestUser,
    details?: any
  ): Promise<void> {
    const auditEntry: Omit<AuditLogEntry, 'id' | 'createdAt'> = {
      userId: user?.id,
      shopId: user?.shop_id,
      action: `DATA_${action.toUpperCase()}`,
      resource,
      resourceId,
      requestData: details,
      severity: this.getDataAccessSeverity(action),
      category: 'data'
    };

    await this.logEvent(auditEntry);
  }

  // Log user actions
  async logUserAction(
    action: string,
    user: RequestUser,
    resource?: string,
    resourceId?: string,
    details?: any
  ): Promise<void> {
    const auditEntry: Omit<AuditLogEntry, 'id' | 'createdAt'> = {
      userId: user.id,
      shopId: user.shop_id,
      action: `USER_${action.toUpperCase()}`,
      resource,
      resourceId,
      requestData: details,
      severity: 'info',
      category: 'user_action'
    };

    await this.logEvent(auditEntry);
  }

  // Log system events
  async logSystemEvent(
    action: string,
    details?: any,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'info'
  ): Promise<void> {
    const auditEntry: Omit<AuditLogEntry, 'id' | 'createdAt'> = {
      action: `SYSTEM_${action.toUpperCase()}`,
      resource: 'system',
      requestData: details,
      severity,
      category: 'system'
    };

    await this.logEvent(auditEntry);
  }

  // Query audit logs
  async queryLogs(query: AuditQuery): Promise<{
    logs: AuditLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      let sql = 'SELECT * FROM audit_logs WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      // Build dynamic query
      if (query.userId) {
        sql += ` AND user_id = $${paramIndex++}`;
        params.push(query.userId);
      }

      if (query.shopId) {
        sql += ` AND shop_id = $${paramIndex++}`;
        params.push(query.shopId);
      }

      if (query.action) {
        sql += ` AND action ILIKE $${paramIndex++}`;
        params.push(`%${query.action}%`);
      }

      if (query.resource) {
        sql += ` AND resource = $${paramIndex++}`;
        params.push(query.resource);
      }

      if (query.category) {
        sql += ` AND request_data->>'category' = $${paramIndex++}`;
        params.push(query.category);
      }

      if (query.severity) {
        sql += ` AND request_data->>'severity' = $${paramIndex++}`;
        params.push(query.severity);
      }

      if (query.ipAddress) {
        sql += ` AND ip_address = $${paramIndex++}`;
        params.push(query.ipAddress);
      }

      if (query.dateFrom) {
        sql += ` AND created_at >= $${paramIndex++}`;
        params.push(query.dateFrom);
      }

      if (query.dateTo) {
        sql += ` AND created_at <= $${paramIndex++}`;
        params.push(query.dateTo);
      }

      // Get total count
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*)');
      const countResult = await this.db.query(countSql, params);
      const total = parseInt(countResult.rows[0].count);

      // Add ordering and pagination
      sql += ' ORDER BY created_at DESC';

      if (query.limit) {
        sql += ` LIMIT $${paramIndex++}`;
        params.push(query.limit);
      }

      if (query.offset) {
        sql += ` OFFSET $${paramIndex++}`;
        params.push(query.offset);
      }

      const result = await this.db.query(sql, params);

      return {
        logs: result.rows,
        total,
        hasMore: (query.offset || 0) + result.rows.length < total
      };

    } catch (error) {
      console.error('Failed to query audit logs:', error);
      return { logs: [], total: 0, hasMore: false };
    }
  }

  // Get audit statistics
  async getStatistics(timeframe: '24h' | '7d' | '30d' = '24h'): Promise<AuditStatistics> {
    try {
      const timeframeSql = this.getTimeframeSql(timeframe);

      // Total events
      const totalResult = await this.db.query(
        `SELECT COUNT(*) as total FROM audit_logs WHERE created_at > ${timeframeSql}`
      );

      // Events by category
      const categoryResult = await this.db.query(
        `SELECT 
          COALESCE(request_data->>'category', 'unknown') as category,
          COUNT(*) as count
         FROM audit_logs 
         WHERE created_at > ${timeframeSql}
         GROUP BY request_data->>'category'`
      );

      // Events by severity
      const severityResult = await this.db.query(
        `SELECT 
          COALESCE(request_data->>'severity', 'unknown') as severity,
          COUNT(*) as count
         FROM audit_logs 
         WHERE created_at > ${timeframeSql}
         GROUP BY request_data->>'severity'`
      );

      // Top users
      const usersResult = await this.db.query(
        `SELECT 
          al.user_id,
          u.email,
          COUNT(*) as count
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.created_at > ${timeframeSql} AND al.user_id IS NOT NULL
         GROUP BY al.user_id, u.email
         ORDER BY count DESC
         LIMIT 10`
      );

      // Top IP addresses
      const ipResult = await this.db.query(
        `SELECT 
          ip_address,
          COUNT(*) as count
         FROM audit_logs 
         WHERE created_at > ${timeframeSql} AND ip_address IS NOT NULL
         GROUP BY ip_address
         ORDER BY count DESC
         LIMIT 10`
      );

      // Recent security events
      const securityResult = await this.db.query(
        `SELECT * FROM audit_logs 
         WHERE request_data->>'category' = 'security' 
         AND created_at > ${timeframeSql}
         ORDER BY created_at DESC 
         LIMIT 20`
      );

      // System health metrics
      const healthResult = await this.db.query(
        `SELECT 
          COUNT(CASE WHEN status_code >= 400 THEN 1 END)::float / COUNT(*)::float * 100 as error_rate,
          AVG(execution_time_ms) as avg_response_time,
          COUNT(CASE WHEN action LIKE '%LOGIN%' AND status_code >= 400 THEN 1 END) as failed_logins,
          COUNT(CASE WHEN request_data->>'category' = 'security' AND request_data->>'severity' IN ('high', 'critical') THEN 1 END) as suspicious_activities
         FROM audit_logs 
         WHERE created_at > ${timeframeSql}`
      );

      const eventsByCategory: Record<string, number> = {};
      categoryResult.rows.forEach(row => {
        eventsByCategory[row.category] = parseInt(row.count);
      });

      const eventsBySeverity: Record<string, number> = {};
      severityResult.rows.forEach(row => {
        eventsBySeverity[row.severity] = parseInt(row.count);
      });

      const health = healthResult.rows[0] || {};

      return {
        totalEvents: parseInt(totalResult.rows[0].total),
        eventsByCategory,
        eventsBySeverity,
        topUsers: usersResult.rows.map(row => ({
          userId: row.user_id,
          email: row.email || 'Unknown',
          count: parseInt(row.count)
        })),
        topIpAddresses: ipResult.rows.map(row => ({
          ipAddress: row.ip_address,
          count: parseInt(row.count)
        })),
        recentSecurityEvents: securityResult.rows,
        systemHealth: {
          errorRate: parseFloat(health.error_rate) || 0,
          averageResponseTime: parseFloat(health.avg_response_time) || 0,
          failedLogins: parseInt(health.failed_logins) || 0,
          suspiciousActivities: parseInt(health.suspicious_activities) || 0
        }
      };

    } catch (error) {
      console.error('Failed to get audit statistics:', error);
      return {
        totalEvents: 0,
        eventsByCategory: {},
        eventsBySeverity: {},
        topUsers: [],
        topIpAddresses: [],
        recentSecurityEvents: [],
        systemHealth: {
          errorRate: 0,
          averageResponseTime: 0,
          failedLogins: 0,
          suspiciousActivities: 0
        }
      };
    }
  }

  // Export audit logs
  async exportLogs(query: AuditQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const result = await this.queryLogs({ ...query, limit: 10000 });

      if (format === 'csv') {
        return this.convertToCSV(result.logs);
      }

      return JSON.stringify(result.logs, null, 2);

    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw new Error('Export failed');
    }
  }

  // Cleanup old logs
  async cleanupLogs(retentionDays: number = 365): Promise<{ deletedCount: number }> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      const result = await this.db.query(
        'DELETE FROM audit_logs WHERE created_at < $1 RETURNING id',
        [cutoffDate]
      );

      const deletedCount = result.rows.length;

      await this.logSystemEvent('AUDIT_CLEANUP', {
        deletedCount,
        retentionDays,
        cutoffDate
      }, 'info');

      return { deletedCount };

    } catch (error) {
      console.error('Failed to cleanup audit logs:', error);
      throw new Error('Cleanup failed');
    }
  }

  // Private helper methods
  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    try {
      const entries = this.batchQueue.splice(0, this.batchSize);
      
      if (entries.length > 0) {
        await this.db.transaction(async (client) => {
          for (const entry of entries) {
            await client.query(
              `INSERT INTO audit_logs (
                correlation_id, user_id, shop_id, action, resource, resource_id,
                ip_address, user_agent, status_code, error_message, request_data,
                response_data, execution_time_ms, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
              [
                entry.correlationId,
                entry.userId,
                entry.shopId,
                entry.action,
                entry.resource,
                entry.resourceId,
                entry.ipAddress,
                entry.userAgent,
                entry.statusCode,
                entry.errorMessage,
                JSON.stringify({
                  severity: entry.severity,
                  category: entry.category,
                  ...entry.requestData
                }),
                JSON.stringify(entry.responseData),
                entry.executionTimeMs,
                entry.createdAt
              ]
            );
          }
        });
      }

    } catch (error) {
      console.error('Failed to flush audit batch:', error);
    }
  }

  private startBatchProcessor(): void {
    // Flush batch every 5 seconds
    this.flushInterval = setInterval(async () => {
      await this.flushBatch();
    }, 5000);

    // Graceful shutdown handling
    process.on('SIGTERM', async () => {
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
      }
      await this.flushBatch();
    });
  }

  private mapSecuritySeverity(severity: string): 'info' | 'warning' | 'error' | 'critical' {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'critical';
      default: return 'info';
    }
  }

  private getHttpSeverity(statusCode: number): 'info' | 'warning' | 'error' | 'critical' {
    if (statusCode >= 500) return 'critical';
    if (statusCode >= 400) return 'error';
    if (statusCode >= 300) return 'warning';
    return 'info';
  }

  private getDataAccessSeverity(action: string): 'info' | 'warning' | 'error' | 'critical' {
    const criticalActions = ['delete', 'truncate', 'drop'];
    const warningActions = ['update', 'insert'];
    
    if (criticalActions.includes(action.toLowerCase())) return 'critical';
    if (warningActions.includes(action.toLowerCase())) return 'warning';
    return 'info';
  }

  private sanitizeRequestData(req: any): any {
    const sanitized: any = {
      method: req.method,
      url: req.url,
      headers: {
        'content-type': req.get('content-type'),
        'user-agent': req.get('user-agent'),
        'origin': req.get('origin')
      }
    };

    // Sanitize body (remove sensitive data)
    if (req.body) {
      sanitized.body = { ...req.body };
      delete sanitized.body.password;
      delete sanitized.body.oldPassword;
      delete sanitized.body.newPassword;
      delete sanitized.body.token;
    }

    return sanitized;
  }

  private sanitizeResponseData(res: any): any {
    // Don't log response data by default for security
    return {
      statusCode: res.statusCode,
      headers: {
        'content-type': res.get('content-type')
      }
    };
  }

  private getTimeframeSql(timeframe: string): string {
    switch (timeframe) {
      case '24h': return 'NOW() - INTERVAL \'24 hours\'';
      case '7d': return 'NOW() - INTERVAL \'7 days\'';
      case '30d': return 'NOW() - INTERVAL \'30 days\'';
      default: return 'NOW() - INTERVAL \'24 hours\'';
    }
  }

  private convertToCSV(logs: AuditLogEntry[]): string {
    if (logs.length === 0) return '';

    const headers = [
      'id', 'correlationId', 'userId', 'shopId', 'action', 'resource',
      'resourceId', 'ipAddress', 'userAgent', 'statusCode', 'severity',
      'category', 'createdAt'
    ];

    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = headers.map(header => {
        let value = log[header as keyof AuditLogEntry];
        if (value === null || value === undefined) value = '';
        if (typeof value === 'object') value = JSON.stringify(value);
        return `"${value}"`;
      });
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  private async triggerSecurityAlert(event: SecurityEvent): Promise<void> {
    try {
      // In production, this would send alerts to monitoring systems
      console.error('CRITICAL SECURITY EVENT:', {
        type: event.type,
        userId: event.userId,
        ipAddress: event.ipAddress,
        details: event.details
      });

      // Log the alert trigger
      await this.logSystemEvent('SECURITY_ALERT_TRIGGERED', event, 'critical');

    } catch (error) {
      console.error('Failed to trigger security alert:', error);
    }
  }
}
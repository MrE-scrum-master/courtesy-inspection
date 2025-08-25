// Role-Based Access Control (RBAC) Middleware
// Advanced permission system with role inheritance and dynamic permissions

import { Request, Response, NextFunction } from 'express';
import { DatabaseService, RequestUser, HttpStatus, AppError } from '../types/common';

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface RolePermission {
  role: string;
  permission: Permission;
}

export interface UserPermission {
  userId: string;
  permission: Permission;
  granted: boolean;
  granteBy?: string;
  grantedAt: Date;
  expiresAt?: Date;
}

export interface AccessContext {
  user: RequestUser;
  resource: string;
  action: string;
  resourceId?: string;
  shopId?: string;
  ownerId?: string;
}

export class RBACMiddleware {
  private db: DatabaseService;
  private permissionCache: Map<string, Permission[]> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate: number = 0;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  // Main authorization middleware
  authorize(resource: string, action: string, options: {
    allowOwnership?: boolean;
    ownershipField?: string;
    shopScope?: boolean;
    adminOverride?: boolean;
  } = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(HttpStatus.UNAUTHORIZED).json({
            success: false,
            error: 'Authentication required'
          });
        }

        const context: AccessContext = {
          user: req.user,
          resource,
          action,
          resourceId: req.params.id || req.params.resourceId,
          shopId: req.params.shopId || req.body.shop_id || req.query.shop_id as string,
          ownerId: req.body.owner_id || req.body.user_id || req.body.technician_id
        };

        const hasAccess = await this.checkAccess(context, options);

        if (!hasAccess.allowed) {
          // Log unauthorized access attempt
          await this.logUnauthorizedAccess(req, context, hasAccess.reason);

          return res.status(HttpStatus.FORBIDDEN).json({
            success: false,
            error: hasAccess.reason || 'Access denied',
            details: {
              resource,
              action,
              userRole: req.user.role,
              permissions: hasAccess.missingPermissions
            }
          });
        }

        // Log successful authorization if enabled
        if (process.env.LOG_AUTHORIZATION === 'true') {
          await this.logAuthorization(req, context, 'GRANTED');
        }

        next();
      } catch (error) {
        console.error('RBAC authorization error:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: 'Authorization check failed'
        });
      }
    };
  }

  // Check if user has specific permission
  hasPermission(permissionName: string, options: {
    shopScope?: boolean;
    allowUserOverride?: boolean;
  } = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(HttpStatus.UNAUTHORIZED).json({
            success: false,
            error: 'Authentication required'
          });
        }

        const hasPermission = await this.checkUserPermission(
          req.user.id,
          permissionName,
          options
        );

        if (!hasPermission) {
          return res.status(HttpStatus.FORBIDDEN).json({
            success: false,
            error: 'Insufficient permissions',
            details: {
              required: permissionName,
              userRole: req.user.role
            }
          });
        }

        next();
      } catch (error) {
        console.error('Permission check error:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: 'Permission check failed'
        });
      }
    };
  }

  // Role-based middleware (enhanced version)
  requireRole(...allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Check role hierarchy
      const userRole = req.user.role;
      const hasAccess = this.checkRoleHierarchy(userRole, allowedRoles);

      if (!hasAccess) {
        return res.status(HttpStatus.FORBIDDEN).json({
          success: false,
          error: 'Insufficient role permissions',
          details: {
            required: allowedRoles,
            current: userRole
          }
        });
      }

      next();
    };
  }

  // Shop-level access control
  requireShopAccess(options: {
    adminOverride?: boolean;
    managerOverride?: boolean;
    allowOwnership?: boolean;
    ownershipField?: string;
  } = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(HttpStatus.UNAUTHORIZED).json({
            success: false,
            error: 'Authentication required'
          });
        }

        const shopId = req.params.shopId || req.body.shop_id || req.query.shop_id as string;

        if (!shopId) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            success: false,
            error: 'Shop ID required'
          });
        }

        // Admin override
        if (options.adminOverride !== false && req.user.role === 'admin') {
          return next();
        }

        // Manager override for their shop
        if (options.managerOverride !== false && 
            req.user.role === 'shop_manager' && 
            req.user.shop_id === shopId) {
          return next();
        }

        // Check if user belongs to the shop
        if (req.user.shop_id !== shopId) {
          // Check ownership if allowed
          if (options.allowOwnership && options.ownershipField) {
            const resourceOwnerId = req.body[options.ownershipField] || req.params[options.ownershipField];
            if (resourceOwnerId === req.user.id) {
              return next();
            }
          }

          return res.status(HttpStatus.FORBIDDEN).json({
            success: false,
            error: 'Access denied to this shop',
            details: {
              userShop: req.user.shop_id,
              requestedShop: shopId
            }
          });
        }

        next();
      } catch (error) {
        console.error('Shop access control error:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: 'Shop access check failed'
        });
      }
    };
  }

  // Resource ownership check
  requireOwnership(options: {
    resourceTable: string;
    ownershipField?: string;
    allowRoles?: string[];
    shopScope?: boolean;
  }) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(HttpStatus.UNAUTHORIZED).json({
            success: false,
            error: 'Authentication required'
          });
        }

        // Allow certain roles to bypass ownership check
        if (options.allowRoles && options.allowRoles.includes(req.user.role)) {
          return next();
        }

        const resourceId = req.params.id || req.params.resourceId;
        if (!resourceId) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            success: false,
            error: 'Resource ID required'
          });
        }

        const ownershipField = options.ownershipField || 'user_id';
        const isOwner = await this.checkResourceOwnership(
          options.resourceTable,
          resourceId,
          req.user.id,
          ownershipField,
          options.shopScope ? req.user.shop_id : undefined
        );

        if (!isOwner) {
          return res.status(HttpStatus.FORBIDDEN).json({
            success: false,
            error: 'Access denied - resource ownership required'
          });
        }

        next();
      } catch (error) {
        console.error('Ownership check error:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: 'Ownership check failed'
        });
      }
    };
  }

  // Conditional permission middleware
  conditionalPermission(conditions: {
    if: (req: Request) => boolean;
    then: { resource: string; action: string };
    else?: { resource: string; action: string };
  }) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const condition = conditions.if(req);
      const requiredPermission = condition ? conditions.then : conditions.else;

      if (!requiredPermission) {
        return next();
      }

      // Use the main authorize middleware
      const authMiddleware = this.authorize(requiredPermission.resource, requiredPermission.action);
      return authMiddleware(req, res, next);
    };
  }

  // Private helper methods
  private async checkAccess(
    context: AccessContext, 
    options: any
  ): Promise<{ allowed: boolean; reason?: string; missingPermissions?: string[] }> {
    const { user, resource, action } = context;

    // Admin override
    if (options.adminOverride !== false && user.role === 'admin') {
      return { allowed: true };
    }

    // Get user permissions
    const userPermissions = await this.getUserPermissions(user.id, user.role);
    const requiredPermission = `${resource}.${action}`;

    // Check direct permission
    const hasDirectPermission = userPermissions.some(p => p.name === requiredPermission);
    if (hasDirectPermission) {
      return { allowed: true };
    }

    // Check ownership if allowed
    if (options.allowOwnership && context.resourceId && context.ownerId) {
      if (context.ownerId === user.id) {
        const ownerPermission = `${resource}.${action}_own`;
        const hasOwnerPermission = userPermissions.some(p => p.name === ownerPermission);
        if (hasOwnerPermission) {
          return { allowed: true };
        }
      }
    }

    // Check shop scope
    if (options.shopScope && context.shopId) {
      if (user.shop_id === context.shopId) {
        const shopPermission = `${resource}.${action}_shop`;
        const hasShopPermission = userPermissions.some(p => p.name === shopPermission);
        if (hasShopPermission) {
          return { allowed: true };
        }
      }
    }

    return {
      allowed: false,
      reason: 'Insufficient permissions',
      missingPermissions: [requiredPermission]
    };
  }

  private async checkUserPermission(
    userId: string, 
    permissionName: string, 
    options: any
  ): Promise<boolean> {
    const userResult = await this.db.query(
      'SELECT role FROM users WHERE id = $1 AND active = true',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return false;
    }

    const userRole = userResult.rows[0].role;
    const permissions = await this.getUserPermissions(userId, userRole);

    return permissions.some(p => p.name === permissionName);
  }

  private async getUserPermissions(userId: string, userRole: string): Promise<Permission[]> {
    const cacheKey = `${userId}:${userRole}`;
    
    // Check cache
    if (this.shouldUseCache()) {
      const cached = this.permissionCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Get role permissions
    const rolePermissionsQuery = `
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role = $1
    `;
    const rolePermissions = await this.db.query(rolePermissionsQuery, [userRole]);

    // Get user-specific permissions (overrides)
    const userPermissionsQuery = `
      SELECT p.*, up.granted FROM permissions p
      JOIN user_permissions up ON p.id = up.permission_id
      WHERE up.user_id = $1 AND (up.expires_at IS NULL OR up.expires_at > NOW())
    `;
    const userPermissions = await this.db.query(userPermissionsQuery, [userId]);

    // Combine permissions
    const permissionMap = new Map();

    // Add role permissions
    rolePermissions.rows.forEach(p => {
      permissionMap.set(p.id, p);
    });

    // Apply user overrides
    userPermissions.rows.forEach(up => {
      if (up.granted) {
        permissionMap.set(up.id, up);
      } else {
        permissionMap.delete(up.id);
      }
    });

    const permissions = Array.from(permissionMap.values());

    // Cache result
    this.permissionCache.set(cacheKey, permissions);
    this.lastCacheUpdate = Date.now();

    return permissions;
  }

  private checkRoleHierarchy(userRole: string, allowedRoles: string[]): boolean {
    // Define role hierarchy
    const roleHierarchy: Record<string, number> = {
      'admin': 100,
      'shop_manager': 50,
      'mechanic': 10
    };

    const userLevel = roleHierarchy[userRole] || 0;
    const maxAllowedLevel = Math.max(...allowedRoles.map(role => roleHierarchy[role] || 0));

    return userLevel >= maxAllowedLevel;
  }

  private async checkResourceOwnership(
    table: string,
    resourceId: string,
    userId: string,
    ownershipField: string,
    shopId?: string
  ): Promise<boolean> {
    let query = `SELECT 1 FROM ${table} WHERE id = $1 AND ${ownershipField} = $2`;
    const params = [resourceId, userId];

    if (shopId) {
      query += ' AND shop_id = $3';
      params.push(shopId);
    }

    const result = await this.db.query(query, params);
    return result.rows.length > 0;
  }

  private shouldUseCache(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheTimeout;
  }

  private async logUnauthorizedAccess(req: Request, context: AccessContext, reason: string): Promise<void> {
    try {
      const correlationId = req.correlationId || crypto.randomUUID();
      
      await this.db.query(
        `INSERT INTO audit_logs (
          correlation_id, user_id, shop_id, action, resource, resource_id,
          ip_address, user_agent, status_code, error_message, request_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          correlationId,
          context.user.id,
          context.user.shop_id,
          'AUTHORIZATION_DENIED',
          context.resource,
          context.resourceId,
          req.ip,
          req.get('User-Agent'),
          HttpStatus.FORBIDDEN,
          reason,
          JSON.stringify({
            method: req.method,
            url: req.url,
            action: context.action,
            userRole: context.user.role
          })
        ]
      );
    } catch (error) {
      console.error('Failed to log unauthorized access:', error);
    }
  }

  private async logAuthorization(req: Request, context: AccessContext, result: string): Promise<void> {
    try {
      const correlationId = req.correlationId || crypto.randomUUID();
      
      await this.db.query(
        `INSERT INTO audit_logs (
          correlation_id, user_id, shop_id, action, resource, resource_id,
          ip_address, user_agent, status_code, request_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          correlationId,
          context.user.id,
          context.user.shop_id,
          `AUTHORIZATION_${result}`,
          context.resource,
          context.resourceId,
          req.ip,
          req.get('User-Agent'),
          HttpStatus.OK,
          JSON.stringify({
            method: req.method,
            url: req.url,
            action: context.action,
            userRole: context.user.role
          })
        ]
      );
    } catch (error) {
      console.error('Failed to log authorization:', error);
    }
  }

  // Cache management methods
  clearPermissionCache(userId?: string, role?: string): void {
    if (userId && role) {
      this.permissionCache.delete(`${userId}:${role}`);
    } else {
      this.permissionCache.clear();
    }
  }

  getCacheStats(): { size: number; lastUpdate: number; entries: string[] } {
    return {
      size: this.permissionCache.size,
      lastUpdate: this.lastCacheUpdate,
      entries: Array.from(this.permissionCache.keys())
    };
  }
}
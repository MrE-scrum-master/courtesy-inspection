// Permissions Configuration - RBAC permission definitions and role mappings
// Defines all system permissions and their role assignments

export interface PermissionDefinition {
  name: string;
  description: string;
  resource: string;
  action: string;
  category: string;
}

export interface RoleDefinition {
  name: string;
  description: string;
  level: number;
  permissions: string[];
  inheritsFrom?: string[];
}

// System Permissions
export const PERMISSIONS: PermissionDefinition[] = [
  // User Management
  {
    name: 'users.create',
    description: 'Create new users',
    resource: 'users',
    action: 'create',
    category: 'user_management'
  },
  {
    name: 'users.read',
    description: 'View user information',
    resource: 'users',
    action: 'read',
    category: 'user_management'
  },
  {
    name: 'users.read_own',
    description: 'View own user information',
    resource: 'users',
    action: 'read_own',
    category: 'user_management'
  },
  {
    name: 'users.update',
    description: 'Update user information',
    resource: 'users',
    action: 'update',
    category: 'user_management'
  },
  {
    name: 'users.update_own',
    description: 'Update own user information',
    resource: 'users',
    action: 'update_own',
    category: 'user_management'
  },
  {
    name: 'users.delete',
    description: 'Delete users',
    resource: 'users',
    action: 'delete',
    category: 'user_management'
  },
  {
    name: 'users.manage_roles',
    description: 'Manage user roles and permissions',
    resource: 'users',
    action: 'manage_roles',
    category: 'user_management'
  },
  {
    name: 'users.impersonate',
    description: 'Impersonate other users',
    resource: 'users',
    action: 'impersonate',
    category: 'user_management'
  },

  // Shop Management
  {
    name: 'shops.create',
    description: 'Create new shops',
    resource: 'shops',
    action: 'create',
    category: 'shop_management'
  },
  {
    name: 'shops.read',
    description: 'View shop information',
    resource: 'shops',
    action: 'read',
    category: 'shop_management'
  },
  {
    name: 'shops.read_own',
    description: 'View own shop information',
    resource: 'shops',
    action: 'read_own',
    category: 'shop_management'
  },
  {
    name: 'shops.update',
    description: 'Update shop information',
    resource: 'shops',
    action: 'update',
    category: 'shop_management'
  },
  {
    name: 'shops.update_own',
    description: 'Update own shop information',
    resource: 'shops',
    action: 'update_own',
    category: 'shop_management'
  },
  {
    name: 'shops.delete',
    description: 'Delete shops',
    resource: 'shops',
    action: 'delete',
    category: 'shop_management'
  },
  {
    name: 'shops.manage',
    description: 'Full shop management',
    resource: 'shops',
    action: 'manage',
    category: 'shop_management'
  },

  // Inspection Management
  {
    name: 'inspections.create',
    description: 'Create new inspections',
    resource: 'inspections',
    action: 'create',
    category: 'inspection_management'
  },
  {
    name: 'inspections.read',
    description: 'View all inspections',
    resource: 'inspections',
    action: 'read',
    category: 'inspection_management'
  },
  {
    name: 'inspections.read_own',
    description: 'View own inspections',
    resource: 'inspections',
    action: 'read_own',
    category: 'inspection_management'
  },
  {
    name: 'inspections.read_shop',
    description: 'View shop inspections',
    resource: 'inspections',
    action: 'read_shop',
    category: 'inspection_management'
  },
  {
    name: 'inspections.update',
    description: 'Update any inspection',
    resource: 'inspections',
    action: 'update',
    category: 'inspection_management'
  },
  {
    name: 'inspections.update_own',
    description: 'Update own inspections',
    resource: 'inspections',
    action: 'update_own',
    category: 'inspection_management'
  },
  {
    name: 'inspections.update_shop',
    description: 'Update shop inspections',
    resource: 'inspections',
    action: 'update_shop',
    category: 'inspection_management'
  },
  {
    name: 'inspections.delete',
    description: 'Delete inspections',
    resource: 'inspections',
    action: 'delete',
    category: 'inspection_management'
  },
  {
    name: 'inspections.approve',
    description: 'Approve/reject inspections',
    resource: 'inspections',
    action: 'approve',
    category: 'inspection_management'
  },
  {
    name: 'inspections.send',
    description: 'Send inspections to customers',
    resource: 'inspections',
    action: 'send',
    category: 'inspection_management'
  },
  {
    name: 'inspections.archive',
    description: 'Archive inspections',
    resource: 'inspections',
    action: 'archive',
    category: 'inspection_management'
  },

  // Customer Management
  {
    name: 'customers.create',
    description: 'Create new customers',
    resource: 'customers',
    action: 'create',
    category: 'customer_management'
  },
  {
    name: 'customers.read',
    description: 'View all customers',
    resource: 'customers',
    action: 'read',
    category: 'customer_management'
  },
  {
    name: 'customers.read_shop',
    description: 'View shop customers',
    resource: 'customers',
    action: 'read_shop',
    category: 'customer_management'
  },
  {
    name: 'customers.update',
    description: 'Update customer information',
    resource: 'customers',
    action: 'update',
    category: 'customer_management'
  },
  {
    name: 'customers.delete',
    description: 'Delete customers',
    resource: 'customers',
    action: 'delete',
    category: 'customer_management'
  },
  {
    name: 'customers.export',
    description: 'Export customer data',
    resource: 'customers',
    action: 'export',
    category: 'customer_management'
  },

  // Communication
  {
    name: 'communications.send_sms',
    description: 'Send SMS messages',
    resource: 'communications',
    action: 'send_sms',
    category: 'communication'
  },
  {
    name: 'communications.send_email',
    description: 'Send email messages',
    resource: 'communications',
    action: 'send_email',
    category: 'communication'
  },
  {
    name: 'communications.view_history',
    description: 'View communication history',
    resource: 'communications',
    action: 'view_history',
    category: 'communication'
  },

  // File Management
  {
    name: 'files.upload',
    description: 'Upload files',
    resource: 'files',
    action: 'upload',
    category: 'file_management'
  },
  {
    name: 'files.download',
    description: 'Download files',
    resource: 'files',
    action: 'download',
    category: 'file_management'
  },
  {
    name: 'files.delete',
    description: 'Delete files',
    resource: 'files',
    action: 'delete',
    category: 'file_management'
  },
  {
    name: 'files.manage',
    description: 'Full file management',
    resource: 'files',
    action: 'manage',
    category: 'file_management'
  },

  // Reporting
  {
    name: 'reports.view',
    description: 'View reports',
    resource: 'reports',
    action: 'view',
    category: 'reporting'
  },
  {
    name: 'reports.view_shop',
    description: 'View shop reports',
    resource: 'reports',
    action: 'view_shop',
    category: 'reporting'
  },
  {
    name: 'reports.export',
    description: 'Export reports',
    resource: 'reports',
    action: 'export',
    category: 'reporting'
  },
  {
    name: 'reports.create',
    description: 'Create custom reports',
    resource: 'reports',
    action: 'create',
    category: 'reporting'
  },

  // System Administration
  {
    name: 'system.admin',
    description: 'System administration access',
    resource: 'system',
    action: 'admin',
    category: 'system_administration'
  },
  {
    name: 'system.audit',
    description: 'View audit logs',
    resource: 'system',
    action: 'audit',
    category: 'system_administration'
  },
  {
    name: 'system.backup',
    description: 'Perform system backups',
    resource: 'system',
    action: 'backup',
    category: 'system_administration'
  },
  {
    name: 'system.config',
    description: 'Modify system configuration',
    resource: 'system',
    action: 'config',
    category: 'system_administration'
  },
  {
    name: 'system.maintenance',
    description: 'Perform system maintenance',
    resource: 'system',
    action: 'maintenance',
    category: 'system_administration'
  },

  // API Access
  {
    name: 'api.access',
    description: 'Access API endpoints',
    resource: 'api',
    action: 'access',
    category: 'api_access'
  },
  {
    name: 'api.external',
    description: 'Use external API integrations',
    resource: 'api',
    action: 'external',
    category: 'api_access'
  },

  // Security
  {
    name: 'security.view_logs',
    description: 'View security logs',
    resource: 'security',
    action: 'view_logs',
    category: 'security'
  },
  {
    name: 'security.manage_sessions',
    description: 'Manage user sessions',
    resource: 'security',
    action: 'manage_sessions',
    category: 'security'
  },
  {
    name: 'security.manage_permissions',
    description: 'Manage permissions',
    resource: 'security',
    action: 'manage_permissions',
    category: 'security'
  }
];

// Role Definitions
export const ROLES: RoleDefinition[] = [
  {
    name: 'admin',
    description: 'System Administrator - Full access to all features',
    level: 100,
    permissions: PERMISSIONS.map(p => p.name) // All permissions
  },
  {
    name: 'shop_manager',
    description: 'Shop Manager - Manage shop operations and staff',
    level: 50,
    permissions: [
      // User management (limited)
      'users.read',
      'users.update_own',
      'users.create', // Can create mechanics for their shop
      
      // Shop management
      'shops.read_own',
      'shops.update_own',
      'shops.manage',
      
      // Inspection management
      'inspections.create',
      'inspections.read_shop',
      'inspections.update_shop',
      'inspections.approve',
      'inspections.send',
      'inspections.archive',
      
      // Customer management
      'customers.create',
      'customers.read_shop',
      'customers.update',
      'customers.delete',
      'customers.export',
      
      // Communication
      'communications.send_sms',
      'communications.send_email',
      'communications.view_history',
      
      // File management
      'files.upload',
      'files.download',
      'files.delete',
      
      // Reporting
      'reports.view_shop',
      'reports.export',
      
      // API access
      'api.access'
    ]
  },
  {
    name: 'mechanic',
    description: 'Mechanic - Create and manage own inspections',
    level: 10,
    permissions: [
      // User management (own only)
      'users.read_own',
      'users.update_own',
      
      // Shop access (read only)
      'shops.read_own',
      
      // Inspection management (own only)
      'inspections.create',
      'inspections.read_own',
      'inspections.update_own',
      
      // Customer management (limited)
      'customers.read_shop',
      'customers.update',
      
      // File management (limited)
      'files.upload',
      'files.download',
      
      // API access
      'api.access'
    ]
  }
];

// Permission Categories
export const PERMISSION_CATEGORIES = {
  user_management: 'User Management',
  shop_management: 'Shop Management',
  inspection_management: 'Inspection Management',
  customer_management: 'Customer Management',
  communication: 'Communication',
  file_management: 'File Management',
  reporting: 'Reporting',
  system_administration: 'System Administration',
  api_access: 'API Access',
  security: 'Security'
};

// Helper functions
export function getPermissionsByCategory(category: string): PermissionDefinition[] {
  return PERMISSIONS.filter(p => p.category === category);
}

export function getRolePermissions(roleName: string): string[] {
  const role = ROLES.find(r => r.name === roleName);
  return role ? role.permissions : [];
}

export function hasPermission(userRole: string, requiredPermission: string): boolean {
  const role = ROLES.find(r => r.name === userRole);
  return role ? role.permissions.includes(requiredPermission) : false;
}

export function canAccess(userRole: string, resource: string, action: string): boolean {
  const permissionName = `${resource}.${action}`;
  return hasPermission(userRole, permissionName);
}

export function getRoleLevel(roleName: string): number {
  const role = ROLES.find(r => r.name === roleName);
  return role ? role.level : 0;
}

export function isHigherRole(role1: string, role2: string): boolean {
  return getRoleLevel(role1) > getRoleLevel(role2);
}

export function getRoleHierarchy(): string[] {
  return ROLES
    .sort((a, b) => b.level - a.level)
    .map(role => role.name);
}

// Permission validation schemas for common operations
export const PERMISSION_SCHEMAS = {
  // User operations
  createUser: ['users.create'],
  updateUser: ['users.update'],
  updateOwnUser: ['users.update_own'],
  deleteUser: ['users.delete'],
  viewUsers: ['users.read'],
  
  // Shop operations
  createShop: ['shops.create'],
  updateShop: ['shops.update'],
  updateOwnShop: ['shops.update_own'],
  deleteShop: ['shops.delete'],
  viewShops: ['shops.read'],
  
  // Inspection operations
  createInspection: ['inspections.create'],
  updateInspection: ['inspections.update'],
  updateOwnInspection: ['inspections.update_own'],
  deleteInspection: ['inspections.delete'],
  viewInspections: ['inspections.read'],
  viewOwnInspections: ['inspections.read_own'],
  approveInspection: ['inspections.approve'],
  sendInspection: ['inspections.send'],
  
  // Customer operations
  createCustomer: ['customers.create'],
  updateCustomer: ['customers.update'],
  deleteCustomer: ['customers.delete'],
  viewCustomers: ['customers.read'],
  exportCustomers: ['customers.export'],
  
  // Administrative operations
  viewAuditLogs: ['system.audit'],
  systemBackup: ['system.backup'],
  systemMaintenance: ['system.maintenance'],
  viewSecurityLogs: ['security.view_logs']
};

// Role-based route protection mapping
export const ROUTE_PERMISSIONS = {
  // Auth routes (public)
  'POST /api/auth/login': [],
  'POST /api/auth/register': [],
  'POST /api/auth/refresh': [],
  'POST /api/auth/logout': [],
  
  // User routes
  'GET /api/users': ['users.read'],
  'POST /api/users': ['users.create'],
  'PUT /api/users/:id': ['users.update'],
  'DELETE /api/users/:id': ['users.delete'],
  'GET /api/users/me': ['users.read_own'],
  'PUT /api/users/me': ['users.update_own'],
  
  // Shop routes
  'GET /api/shops': ['shops.read'],
  'POST /api/shops': ['shops.create'],
  'PUT /api/shops/:id': ['shops.update'],
  'DELETE /api/shops/:id': ['shops.delete'],
  
  // Inspection routes
  'GET /api/inspections': ['inspections.read_shop'],
  'POST /api/inspections': ['inspections.create'],
  'PUT /api/inspections/:id': ['inspections.update_own'],
  'DELETE /api/inspections/:id': ['inspections.delete'],
  'POST /api/inspections/:id/approve': ['inspections.approve'],
  'POST /api/inspections/:id/send': ['inspections.send'],
  
  // Customer routes
  'GET /api/customers': ['customers.read_shop'],
  'POST /api/customers': ['customers.create'],
  'PUT /api/customers/:id': ['customers.update'],
  'DELETE /api/customers/:id': ['customers.delete'],
  
  // Report routes
  'GET /api/reports': ['reports.view_shop'],
  'GET /api/reports/export': ['reports.export'],
  
  // Admin routes
  'GET /api/admin/audit': ['system.audit'],
  'POST /api/admin/backup': ['system.backup'],
  'GET /api/admin/security': ['security.view_logs']
};

export default {
  PERMISSIONS,
  ROLES,
  PERMISSION_CATEGORIES,
  PERMISSION_SCHEMAS,
  ROUTE_PERMISSIONS,
  getPermissionsByCategory,
  getRolePermissions,
  hasPermission,
  canAccess,
  getRoleLevel,
  isHigherRole,
  getRoleHierarchy
};
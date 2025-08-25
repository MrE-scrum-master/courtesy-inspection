-- Security Enhancement Migration
-- Creates tables for refresh tokens, audit logs, password history, and login attempts

-- Add TOO_MANY_REQUESTS to HttpStatus if not exists
-- This will be handled in TypeScript enums

-- Refresh Tokens Table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_revoked_at ON refresh_tokens(revoked_at);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id UUID,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    status_code INTEGER,
    error_message TEXT,
    request_data JSONB,
    response_data JSONB,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_shop_id ON audit_logs(shop_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_correlation_id ON audit_logs(correlation_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Password History Table
CREATE TABLE IF NOT EXISTS password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_password_history_user_id ON password_history(user_id);
CREATE INDEX idx_password_history_created_at ON password_history(created_at);

-- Login Attempts Table (for rate limiting and security)
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    failure_reason TEXT,
    attempts_count INTEGER DEFAULT 1,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_ip_address ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_created_at ON login_attempts(created_at);
CREATE INDEX idx_login_attempts_locked_until ON login_attempts(locked_until);

-- CSRF Tokens Table
CREATE TABLE IF NOT EXISTS csrf_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_csrf_tokens_user_id ON csrf_tokens(user_id);
CREATE INDEX idx_csrf_tokens_token_hash ON csrf_tokens(token_hash);
CREATE INDEX idx_csrf_tokens_expires_at ON csrf_tokens(expires_at);

-- Session Management Table (enhanced version of user_sessions)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    refresh_token_id UUID REFERENCES refresh_tokens(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX idx_user_sessions_refresh_token_id ON user_sessions(refresh_token_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity);

-- Add security-related columns to users table if not exists
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);

-- Create indexes for new user columns
CREATE INDEX IF NOT EXISTS idx_users_failed_login_attempts ON users(failed_login_attempts);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);

-- Add permissions table for RBAC
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);

-- Role Permissions Junction Table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(50) NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- User Specific Permissions (overrides)
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN NOT NULL DEFAULT TRUE,
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, permission_id)
);

CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission_id ON user_permissions(permission_id);

-- Insert default permissions
INSERT INTO permissions (name, description, resource, action) VALUES 
-- User management
('users.create', 'Create new users', 'users', 'create'),
('users.read', 'View user information', 'users', 'read'),
('users.update', 'Update user information', 'users', 'update'),
('users.delete', 'Delete users', 'users', 'delete'),
('users.manage_roles', 'Manage user roles', 'users', 'manage_roles'),

-- Shop management
('shops.create', 'Create new shops', 'shops', 'create'),
('shops.read', 'View shop information', 'shops', 'read'),
('shops.update', 'Update shop information', 'shops', 'update'),
('shops.delete', 'Delete shops', 'shops', 'delete'),
('shops.manage', 'Full shop management', 'shops', 'manage'),

-- Inspection management
('inspections.create', 'Create new inspections', 'inspections', 'create'),
('inspections.read', 'View inspections', 'inspections', 'read'),
('inspections.read_own', 'View own inspections', 'inspections', 'read_own'),
('inspections.update', 'Update inspections', 'inspections', 'update'),
('inspections.update_own', 'Update own inspections', 'inspections', 'update_own'),
('inspections.delete', 'Delete inspections', 'inspections', 'delete'),
('inspections.approve', 'Approve/reject inspections', 'inspections', 'approve'),
('inspections.send', 'Send inspections to customers', 'inspections', 'send'),

-- Customer management
('customers.create', 'Create new customers', 'customers', 'create'),
('customers.read', 'View customers', 'customers', 'read'),
('customers.update', 'Update customer information', 'customers', 'update'),
('customers.delete', 'Delete customers', 'customers', 'delete'),

-- Reporting
('reports.view', 'View reports', 'reports', 'view'),
('reports.export', 'Export reports', 'reports', 'export'),

-- System administration
('system.admin', 'System administration', 'system', 'admin'),
('system.audit', 'View audit logs', 'system', 'audit'),
('system.backup', 'Perform system backups', 'system', 'backup')

ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
INSERT INTO role_permissions (role, permission_id) 
SELECT 'admin', id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id) 
SELECT 'shop_manager', id FROM permissions 
WHERE name IN (
    'users.read', 'users.update', 
    'shops.read', 'shops.update',
    'inspections.create', 'inspections.read', 'inspections.update', 'inspections.approve', 'inspections.send',
    'customers.create', 'customers.read', 'customers.update', 'customers.delete',
    'reports.view', 'reports.export'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id) 
SELECT 'mechanic', id FROM permissions 
WHERE name IN (
    'inspections.create', 'inspections.read_own', 'inspections.update_own',
    'customers.read', 'customers.update'
)
ON CONFLICT DO NOTHING;

-- Function to cleanup expired tokens and sessions
CREATE OR REPLACE FUNCTION cleanup_expired_security_data()
RETURNS void AS $$
BEGIN
    -- Delete expired refresh tokens
    DELETE FROM refresh_tokens WHERE expires_at < NOW();
    
    -- Delete expired user sessions
    DELETE FROM user_sessions WHERE expires_at < NOW();
    
    -- Delete expired CSRF tokens
    DELETE FROM csrf_tokens WHERE expires_at < NOW();
    
    -- Delete old audit logs (keep for 1 year)
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 year';
    
    -- Delete old password history (keep last 5 per user)
    DELETE FROM password_history 
    WHERE id NOT IN (
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
            FROM password_history
        ) ranked WHERE rn <= 5
    );
    
    -- Delete old login attempts (keep for 30 days)
    DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL '30 days';
    
    RAISE NOTICE 'Security data cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Function to trigger password history update
CREATE OR REPLACE FUNCTION update_password_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if password actually changed
    IF OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
        -- Store old password in history
        INSERT INTO password_history (user_id, password_hash) 
        VALUES (OLD.id, OLD.password_hash);
        
        -- Update password changed timestamp
        NEW.password_changed_at = NOW();
        
        -- Reset failed login attempts
        NEW.failed_login_attempts = 0;
        NEW.locked_until = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for password history
DROP TRIGGER IF EXISTS trigger_password_history ON users;
CREATE TRIGGER trigger_password_history
    BEFORE UPDATE OF password_hash ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_password_history();

-- Function to automatically clean up expired data (run daily)
-- This should be called by a cron job or scheduled task
CREATE OR REPLACE FUNCTION schedule_security_cleanup()
RETURNS void AS $$
BEGIN
    PERFORM cleanup_expired_security_data();
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Policies
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Policies for refresh_tokens (users can only see their own)
CREATE POLICY refresh_tokens_user_policy ON refresh_tokens
    FOR ALL TO authenticated_user
    USING (user_id = current_setting('auth.user_id')::uuid);

-- Policies for user_sessions (users can only see their own)
CREATE POLICY user_sessions_user_policy ON user_sessions
    FOR ALL TO authenticated_user
    USING (user_id = current_setting('auth.user_id')::uuid);

-- Policies for password_history (users can only see their own)
CREATE POLICY password_history_user_policy ON password_history
    FOR ALL TO authenticated_user
    USING (user_id = current_setting('auth.user_id')::uuid);

-- Note: audit_logs should only be accessible to admins (handled in application layer)
-- Note: login_attempts should only be accessible to system (handled in application layer)

COMMIT;
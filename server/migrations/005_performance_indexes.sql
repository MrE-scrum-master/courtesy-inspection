-- Performance optimization indexes and database improvements
-- Wave 6: Production readiness optimizations

-- Add performance indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspections_shop_status 
ON inspections(shop_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspections_customer 
ON inspections(customer_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspections_technician 
ON inspections(technician_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspections_date_range 
ON inspections(shop_id, created_at) 
WHERE status != 'draft';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspection_items_inspection 
ON inspection_items(inspection_id, category, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspection_items_urgency 
ON inspection_items(inspection_id, urgency_level) 
WHERE urgency_level IN ('high', 'critical');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active 
ON users(email) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_shop_role 
ON users(shop_id, role) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_shop_search 
ON customers(shop_id, first_name, last_name, email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_photos_inspection 
ON photos(inspection_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_history_inspection 
ON workflow_history(inspection_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_action 
ON audit_logs(user_id, action, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource 
ON audit_logs(resource_type, resource_id, created_at DESC);

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspections_complex_search 
ON inspections(shop_id, status, inspection_type, created_at DESC) 
INCLUDE (customer_id, technician_id, vehicle_make, vehicle_model);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspection_items_summary 
ON inspection_items(inspection_id, status, urgency_level) 
INCLUDE (category, item_name, notes);

-- Partial indexes for specific use cases
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspections_pending_approval 
ON inspections(shop_id, created_at DESC) 
WHERE status = 'pending_approval';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspections_in_progress 
ON inspections(technician_id, created_at DESC) 
WHERE status = 'in_progress';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspections_overdue 
ON inspections(shop_id, started_at) 
WHERE status IN ('in_progress', 'pending_approval') 
  AND started_at < NOW() - INTERVAL '24 hours';

-- Performance optimization for text search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_text_search 
ON customers USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || email));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspections_notes_search 
ON inspections USING gin(to_tsvector('english', COALESCE(notes, '')));

-- Optimize foreign key lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspections_customer_fk 
ON inspections(customer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspections_technician_fk 
ON inspections(technician_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspection_items_inspection_fk 
ON inspection_items(inspection_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_photos_inspection_fk 
ON photos(inspection_id);

-- Add statistics for query planner
ANALYZE inspections;
ANALYZE inspection_items;
ANALYZE customers;
ANALYZE users;
ANALYZE photos;
ANALYZE workflow_history;
ANALYZE audit_logs;

-- Create materialized view for dashboard metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS shop_metrics_daily AS
SELECT 
    shop_id,
    DATE(created_at) as metric_date,
    COUNT(*) as total_inspections,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_inspections,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_inspections,
    COUNT(*) FILTER (WHERE status = 'pending_approval') as pending_approval_inspections,
    AVG(
        CASE 
            WHEN status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (completed_at - started_at))/3600.0 
        END
    ) as avg_completion_hours,
    COUNT(DISTINCT customer_id) as unique_customers,
    COUNT(DISTINCT technician_id) as active_technicians
FROM inspections 
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY shop_id, DATE(created_at);

-- Index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_metrics_daily_unique 
ON shop_metrics_daily(shop_id, metric_date);

-- Create function to refresh metrics
CREATE OR REPLACE FUNCTION refresh_shop_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY shop_metrics_daily;
    
    -- Update table statistics
    ANALYZE inspections;
    ANALYZE inspection_items;
    ANALYZE customers;
END;
$$;

-- Add check constraints for data integrity
ALTER TABLE inspections 
ADD CONSTRAINT check_vehicle_year 
CHECK (vehicle_year >= 1900 AND vehicle_year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1);

ALTER TABLE inspections 
ADD CONSTRAINT check_mileage_positive 
CHECK (mileage >= 0 AND mileage <= 1000000);

ALTER TABLE inspection_items 
ADD CONSTRAINT check_urgency_level 
CHECK (urgency_level IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE inspection_items 
ADD CONSTRAINT check_status_valid 
CHECK (status IN ('good', 'fair', 'needs_attention', 'needs_service', 'critical', 'not_inspected'));

-- Add database-level defaults for better performance
ALTER TABLE inspections 
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE inspection_items 
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN urgency_level SET DEFAULT 'low';

-- Add trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_inspections_updated_at ON inspections;
CREATE TRIGGER update_inspections_updated_at 
    BEFORE UPDATE ON inspections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inspection_items_updated_at ON inspection_items;
CREATE TRIGGER update_inspection_items_updated_at 
    BEFORE UPDATE ON inspection_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add database functions for common operations
CREATE OR REPLACE FUNCTION get_inspection_summary(p_inspection_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'inspection_id', i.id,
        'status', i.status,
        'total_items', COUNT(ii.id),
        'items_by_status', json_object_agg(ii.status, status_count),
        'urgency_summary', json_object_agg(ii.urgency_level, urgency_count),
        'completion_percentage', 
            CASE 
                WHEN COUNT(ii.id) > 0 
                THEN ROUND((COUNT(ii.id) FILTER (WHERE ii.status != 'not_inspected')::numeric / COUNT(ii.id)) * 100, 2)
                ELSE 0 
            END
    )
    INTO result
    FROM inspections i
    LEFT JOIN (
        SELECT 
            inspection_id,
            status,
            urgency_level,
            COUNT(*) OVER (PARTITION BY inspection_id, status) as status_count,
            COUNT(*) OVER (PARTITION BY inspection_id, urgency_level) as urgency_count,
            id
        FROM inspection_items
    ) ii ON i.id = ii.inspection_id
    WHERE i.id = p_inspection_id
    GROUP BY i.id, i.status;
    
    RETURN result;
END;
$$;

-- Add function for shop performance metrics
CREATE OR REPLACE FUNCTION get_shop_performance(p_shop_id UUID, p_days INTEGER DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'period_days', p_days,
        'total_inspections', COUNT(*),
        'completed_inspections', COUNT(*) FILTER (WHERE status = 'completed'),
        'average_completion_time_hours', 
            ROUND(AVG(
                CASE 
                    WHEN status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (completed_at - started_at))/3600.0 
                END
            )::numeric, 2),
        'completion_rate', 
            ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0)) * 100, 2),
        'customer_satisfaction', 
            ROUND(AVG(customer_rating)::numeric, 2),
        'technician_efficiency', json_object_agg(
            u.full_name, 
            json_build_object(
                'inspections_completed', COUNT(*) FILTER (WHERE i.status = 'completed'),
                'avg_time_hours', ROUND(AVG(
                    CASE 
                        WHEN i.status = 'completed' AND i.started_at IS NOT NULL AND i.completed_at IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (i.completed_at - i.started_at))/3600.0 
                    END
                )::numeric, 2)
            )
        )
    )
    INTO result
    FROM inspections i
    LEFT JOIN users u ON i.technician_id = u.id
    WHERE i.shop_id = p_shop_id 
        AND i.created_at >= CURRENT_DATE - INTERVAL '1 day' * p_days
    GROUP BY p_days;
    
    RETURN result;
END;
$$;

-- Add connection pooling settings (these would typically go in postgresql.conf)
-- For documentation purposes:
/*
Recommended PostgreSQL settings for production:

max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
*/

-- Grant appropriate permissions
GRANT SELECT ON shop_metrics_daily TO app_user;
GRANT EXECUTE ON FUNCTION get_inspection_summary(UUID) TO app_user;
GRANT EXECUTE ON FUNCTION get_shop_performance(UUID, INTEGER) TO app_user;
GRANT EXECUTE ON FUNCTION refresh_shop_metrics() TO app_user;

-- Add comments for documentation
COMMENT ON MATERIALIZED VIEW shop_metrics_daily IS 'Daily aggregated metrics for shop performance dashboard';
COMMENT ON FUNCTION get_inspection_summary(UUID) IS 'Returns summary statistics for a specific inspection';
COMMENT ON FUNCTION get_shop_performance(UUID, INTEGER) IS 'Returns performance metrics for a shop over specified days';
COMMENT ON FUNCTION refresh_shop_metrics() IS 'Refreshes materialized views and updates table statistics';
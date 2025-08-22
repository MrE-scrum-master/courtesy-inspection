-- Performance Optimizations Migration
-- Additional indexes, query optimizations, and performance monitoring
-- Supports <200ms API response times and <50ms database queries

-- Performance monitoring table
CREATE TABLE IF NOT EXISTS query_performance_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_name VARCHAR(100) NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    query_hash VARCHAR(64),
    parameters_count INTEGER,
    result_count INTEGER,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shop_id UUID REFERENCES shops(id),
    user_id UUID REFERENCES users(id)
);

-- Additional composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_inspections_shop_state_date ON inspections(shop_id, workflow_state, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inspections_shop_assigned_state ON inspections(shop_id, assigned_to, workflow_state) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inspections_shop_urgency_date ON inspections(shop_id, urgency_level, state_changed_at ASC) 
WHERE deleted_at IS NULL AND urgency_level IN ('critical', 'high');

CREATE INDEX IF NOT EXISTS idx_inspections_customer_vehicle ON inspections(vehicle_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Inspection items performance indexes
CREATE INDEX IF NOT EXISTS idx_inspection_items_inspection_condition ON inspection_items(inspection_id, condition) 
WHERE condition IN ('poor', 'needs_immediate');

CREATE INDEX IF NOT EXISTS idx_inspection_items_inspection_priority ON inspection_items(inspection_id, priority DESC);

CREATE INDEX IF NOT EXISTS idx_inspection_items_category_condition ON inspection_items(category, condition);

-- Photos performance indexes  
CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection_item ON inspection_photos(inspection_id, inspection_item_id) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_inspection_photos_upload_date ON inspection_photos(inspection_id, created_at DESC) 
WHERE status = 'active';

-- Voice notes performance indexes
CREATE INDEX IF NOT EXISTS idx_voice_notes_inspection_confidence ON inspection_voice_notes(inspection_id, confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_voice_notes_processed_date ON inspection_voice_notes(processed_at DESC);

-- State history performance indexes
CREATE INDEX IF NOT EXISTS idx_state_history_inspection_date ON inspection_state_history(inspection_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_state_history_user_date ON inspection_state_history(changed_by, changed_at DESC);

-- Customers and vehicles performance indexes
CREATE INDEX IF NOT EXISTS idx_customers_shop_name ON customers(shop_id, (first_name || ' ' || last_name));

CREATE INDEX IF NOT EXISTS idx_customers_phone_shop ON customers(phone, shop_id) WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_customer_make_model ON vehicles(customer_id, make, model);

CREATE INDEX IF NOT EXISTS idx_vehicles_vin_shop ON vehicles(vin, customer_id) WHERE vin IS NOT NULL;

-- Users performance indexes
CREATE INDEX IF NOT EXISTS idx_users_shop_role ON users(shop_id, role) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_users_shop_email ON users(shop_id, email) WHERE is_active = true;

-- Partial indexes for hot queries
CREATE INDEX IF NOT EXISTS idx_inspections_pending_review_hot ON inspections(shop_id, state_changed_at ASC) 
WHERE workflow_state = 'pending_review' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inspections_in_progress_hot ON inspections(shop_id, assigned_to, started_at) 
WHERE workflow_state = 'in_progress' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inspections_critical_urgent_hot ON inspections(shop_id, urgency_level, created_at DESC) 
WHERE urgency_level = 'critical' AND deleted_at IS NULL;

-- Function for query performance logging
CREATE OR REPLACE FUNCTION log_query_performance(
    p_query_name VARCHAR(100),
    p_execution_time_ms INTEGER,
    p_query_hash VARCHAR(64) DEFAULT NULL,
    p_parameters_count INTEGER DEFAULT 0,
    p_result_count INTEGER DEFAULT 0,
    p_shop_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Only log slow queries (>100ms) or critical queries
    IF p_execution_time_ms > 100 OR p_query_name LIKE '%critical%' THEN
        INSERT INTO query_performance_log (
            query_name, execution_time_ms, query_hash, 
            parameters_count, result_count, shop_id, user_id
        ) VALUES (
            p_query_name, p_execution_time_ms, p_query_hash,
            p_parameters_count, p_result_count, p_shop_id, p_user_id
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Don't fail the main query if logging fails
        NULL;
END;
$$ LANGUAGE plpgsql;

-- Materialized view for dashboard statistics (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS shop_dashboard_stats AS
SELECT 
    i.shop_id,
    COUNT(*) as total_inspections,
    COUNT(CASE WHEN i.workflow_state = 'draft' THEN 1 END) as draft_count,
    COUNT(CASE WHEN i.workflow_state = 'in_progress' THEN 1 END) as in_progress_count,
    COUNT(CASE WHEN i.workflow_state = 'pending_review' THEN 1 END) as pending_review_count,
    COUNT(CASE WHEN i.workflow_state = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN i.workflow_state = 'sent_to_customer' THEN 1 END) as sent_count,
    COUNT(CASE WHEN i.workflow_state = 'completed' THEN 1 END) as completed_count,
    COUNT(CASE WHEN i.urgency_level = 'critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN i.urgency_level = 'high' THEN 1 END) as high_urgency_count,
    ROUND(AVG(i.inspection_duration), 2) as avg_duration_minutes,
    COALESCE(SUM(i.estimated_cost), 0) as total_estimated_value,
    MAX(i.updated_at) as last_updated
FROM inspections i
WHERE i.deleted_at IS NULL 
    AND i.created_at >= NOW() - INTERVAL '30 days'
GROUP BY i.shop_id;

-- Index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_dashboard_stats_shop_id ON shop_dashboard_stats(shop_id);

-- Function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY shop_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Materialized view for inspection search optimization
CREATE MATERIALIZED VIEW IF NOT EXISTS inspection_search_index AS
SELECT 
    i.id,
    i.shop_id,
    i.workflow_state,
    i.urgency_level,
    i.created_at,
    i.assigned_to,
    c.first_name || ' ' || c.last_name as customer_name,
    c.phone as customer_phone,
    v.year || ' ' || v.make || ' ' || v.model as vehicle_info,
    v.vin,
    v.license_plate,
    u.first_name || ' ' || u.last_name as technician_name,
    (c.first_name || ' ' || c.last_name || ' ' || 
     COALESCE(v.make, '') || ' ' || COALESCE(v.model, '') || ' ' || 
     COALESCE(v.vin, '') || ' ' || COALESCE(v.license_plate, '')) as search_text
FROM inspections i
JOIN vehicles v ON i.vehicle_id = v.id
JOIN customers c ON v.customer_id = c.id
JOIN users u ON i.created_by = u.id
WHERE i.deleted_at IS NULL;

-- Text search index for fast searching
CREATE INDEX IF NOT EXISTS idx_inspection_search_text ON inspection_search_index 
USING gin(to_tsvector('english', search_text));

CREATE INDEX IF NOT EXISTS idx_inspection_search_shop_date ON inspection_search_index(shop_id, created_at DESC);

-- Function to refresh search index
CREATE OR REPLACE FUNCTION refresh_search_index()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY inspection_search_index;
END;
$$ LANGUAGE plpgsql;

-- Optimized function for getting pending attention items
CREATE OR REPLACE FUNCTION get_inspections_requiring_attention(p_shop_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
    inspection_id UUID,
    customer_name TEXT,
    vehicle_info TEXT,
    workflow_state VARCHAR(50),
    urgency_level VARCHAR(20),
    critical_items BIGINT,
    hours_waiting NUMERIC,
    priority_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        c.first_name || ' ' || c.last_name,
        v.year || ' ' || v.make || ' ' || v.model,
        i.workflow_state,
        i.urgency_level,
        (SELECT COUNT(*) FROM inspection_items ii 
         WHERE ii.inspection_id = i.id AND ii.condition = 'needs_immediate'),
        ROUND(EXTRACT(EPOCH FROM (NOW() - i.state_changed_at))/3600, 1),
        CASE i.urgency_level 
            WHEN 'critical' THEN 100
            WHEN 'high' THEN 75
            WHEN 'normal' THEN 50
            ELSE 25
        END +
        CASE 
            WHEN i.workflow_state = 'pending_review' AND i.state_changed_at < NOW() - INTERVAL '24 hours' THEN 25
            WHEN i.workflow_state = 'in_progress' AND i.started_at < NOW() - INTERVAL '2 hours' THEN 15
            ELSE 0
        END as priority_score
    FROM inspections i
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN customers c ON v.customer_id = c.id
    WHERE i.shop_id = p_shop_id 
        AND i.deleted_at IS NULL
        AND (
            i.urgency_level IN ('critical', 'high') OR
            (i.workflow_state = 'in_progress' AND i.started_at < NOW() - INTERVAL '2 hours') OR
            (i.workflow_state = 'pending_review' AND i.state_changed_at < NOW() - INTERVAL '24 hours')
        )
    ORDER BY priority_score DESC, i.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Optimized function for inspection statistics
CREATE OR REPLACE FUNCTION get_inspection_statistics(
    p_shop_id UUID, 
    p_date_from DATE DEFAULT NULL, 
    p_date_to DATE DEFAULT NULL
)
RETURNS TABLE(
    total_inspections BIGINT,
    draft_count BIGINT,
    in_progress_count BIGINT,
    pending_review_count BIGINT,
    approved_count BIGINT,
    sent_count BIGINT,
    completed_count BIGINT,
    critical_count BIGINT,
    high_urgency_count BIGINT,
    avg_duration_minutes NUMERIC,
    total_estimated_value NUMERIC,
    completion_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN i.workflow_state = 'draft' THEN 1 END),
        COUNT(CASE WHEN i.workflow_state = 'in_progress' THEN 1 END),
        COUNT(CASE WHEN i.workflow_state = 'pending_review' THEN 1 END),
        COUNT(CASE WHEN i.workflow_state = 'approved' THEN 1 END),
        COUNT(CASE WHEN i.workflow_state = 'sent_to_customer' THEN 1 END),
        COUNT(CASE WHEN i.workflow_state = 'completed' THEN 1 END),
        COUNT(CASE WHEN i.urgency_level = 'critical' THEN 1 END),
        COUNT(CASE WHEN i.urgency_level = 'high' THEN 1 END),
        ROUND(AVG(i.inspection_duration), 2),
        COALESCE(SUM(i.estimated_cost), 0),
        ROUND(
            (COUNT(CASE WHEN i.workflow_state = 'completed' THEN 1 END) * 100.0 / 
             NULLIF(COUNT(CASE WHEN i.workflow_state != 'draft' THEN 1 END), 0)), 2
        )
    FROM inspections i
    WHERE i.shop_id = p_shop_id 
        AND i.deleted_at IS NULL
        AND (p_date_from IS NULL OR i.created_at >= p_date_from)
        AND (p_date_to IS NULL OR i.created_at <= p_date_to);
END;
$$ LANGUAGE plpgsql;

-- Connection pool settings for better performance
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;

-- Create a function to analyze query performance
CREATE OR REPLACE FUNCTION analyze_query_performance()
RETURNS TABLE(
    query_name VARCHAR(100),
    avg_execution_time_ms NUMERIC,
    max_execution_time_ms INTEGER,
    total_executions BIGINT,
    slow_queries_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qpl.query_name,
        ROUND(AVG(qpl.execution_time_ms), 2),
        MAX(qpl.execution_time_ms),
        COUNT(*),
        COUNT(CASE WHEN qpl.execution_time_ms > 200 THEN 1 END)
    FROM query_performance_log qpl
    WHERE qpl.executed_at >= NOW() - INTERVAL '24 hours'
    GROUP BY qpl.query_name
    ORDER BY avg_execution_time_ms DESC;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for old performance logs
CREATE OR REPLACE FUNCTION cleanup_performance_logs()
RETURNS VOID AS $$
BEGIN
    -- Keep only last 7 days of performance logs
    DELETE FROM query_performance_log 
    WHERE executed_at < NOW() - INTERVAL '7 days';
    
    -- Vacuum the table to reclaim space
    VACUUM ANALYZE query_performance_log;
    
    RAISE NOTICE 'Performance logs cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Schedule materialized view refreshes (requires pg_cron extension)
-- SELECT cron.schedule('refresh-dashboard-stats', '*/15 * * * *', 'SELECT refresh_dashboard_stats();');
-- SELECT cron.schedule('refresh-search-index', '*/30 * * * *', 'SELECT refresh_search_index();');
-- SELECT cron.schedule('cleanup-performance', '0 2 * * *', 'SELECT cleanup_performance_logs();');

COMMIT;
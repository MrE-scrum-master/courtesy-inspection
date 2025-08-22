// Database utility functions and connection management
// Extends the template database service with additional utilities

import { DatabaseService } from '../types/common';

// Import the database service from templates
const createDatabase = require('../../../templates/db');

export class DatabaseUtils {
  private static instance: DatabaseService;

  // Get singleton database instance
  static getInstance(): DatabaseService {
    if (!DatabaseUtils.instance) {
      DatabaseUtils.instance = createDatabase();
    }
    return DatabaseUtils.instance;
  }

  // Health check for database connection
  static async healthCheck(): Promise<{ status: string; database: string; timestamp: string }> {
    try {
      const db = DatabaseUtils.getInstance();
      const result = await db.query('SELECT NOW() as timestamp, version() as version');
      
      return {
        status: 'healthy',
        database: 'connected',
        timestamp: result.rows[0].timestamp
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get database connection statistics
  static async getConnectionStats(): Promise<any> {
    try {
      const db = DatabaseUtils.getInstance();
      const result = await db.query(`
        SELECT 
          COUNT(*) as active_connections,
          MAX(backend_start) as oldest_connection,
          COUNT(CASE WHEN state = 'active' THEN 1 END) as active_queries
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('Database connection stats error:', error);
      return null;
    }
  }

  // Clean up expired sessions
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const db = DatabaseUtils.getInstance();
      const result = await db.query(
        'DELETE FROM user_sessions WHERE expires_at < NOW()'
      );
      
      return result.rowCount || 0;
    } catch (error) {
      console.error('Session cleanup error:', error);
      return 0;
    }
  }

  // Archive old inspections
  static async archiveOldInspections(daysOld: number = 365): Promise<number> {
    try {
      const db = DatabaseUtils.getInstance();
      const result = await db.query(
        `UPDATE inspections 
         SET status = 'archived' 
         WHERE status != 'archived' 
           AND completed_at < NOW() - INTERVAL '${daysOld} days'`
      );
      
      return result.rowCount || 0;
    } catch (error) {
      console.error('Archive inspections error:', error);
      return 0;
    }
  }

  // Get table sizes for monitoring
  static async getTableSizes(): Promise<any[]> {
    try {
      const db = DatabaseUtils.getInstance();
      const result = await db.query(`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation,
          most_common_vals
        FROM pg_stats 
        WHERE schemaname = 'public'
        ORDER BY schemaname, tablename
      `);
      
      return result.rows;
    } catch (error) {
      console.error('Table sizes error:', error);
      return [];
    }
  }

  // Backup database schema
  static async getSchemaInfo(): Promise<any[]> {
    try {
      const db = DatabaseUtils.getInstance();
      const result = await db.query(`
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);
      
      return result.rows;
    } catch (error) {
      console.error('Schema info error:', error);
      return [];
    }
  }

  // Database maintenance
  static async runMaintenance(): Promise<{ 
    expiredSessionsRemoved: number;
    archivedInspections: number;
    status: string;
  }> {
    try {
      console.log('Starting database maintenance...');
      
      const expiredSessionsRemoved = await this.cleanupExpiredSessions();
      const archivedInspections = await this.archiveOldInspections();
      
      console.log('Database maintenance completed:', {
        expiredSessionsRemoved,
        archivedInspections
      });

      return {
        expiredSessionsRemoved,
        archivedInspections,
        status: 'completed'
      };
    } catch (error) {
      console.error('Database maintenance error:', error);
      return {
        expiredSessionsRemoved: 0,
        archivedInspections: 0,
        status: 'failed'
      };
    }
  }

  // Close database connections
  static async close(): Promise<void> {
    try {
      if (DatabaseUtils.instance) {
        await DatabaseUtils.instance.close();
      }
    } catch (error) {
      console.error('Database close error:', error);
    }
  }

  // Transaction helper
  static async withTransaction<T>(
    callback: (db: DatabaseService) => Promise<T>
  ): Promise<T> {
    const db = DatabaseUtils.getInstance();
    return await db.transaction(callback);
  }

  // Seed database with test data (development only)
  static async seedTestData(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Cannot seed test data in production');
      return;
    }

    try {
      const db = DatabaseUtils.getInstance();

      console.log('Seeding test data...');

      // This would typically insert test users, shops, customers, etc.
      // For MVP, the data is already seeded via migrations
      
      console.log('Test data seeded successfully');
    } catch (error) {
      console.error('Seed test data error:', error);
      throw error;
    }
  }
}
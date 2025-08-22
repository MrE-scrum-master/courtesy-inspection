// PostgreSQL Database Connection and Query Wrapper
// Railway PostgreSQL with connection pooling and transactions
// KISS, DRY, SOLID principles

const { Pool } = require('pg');

class DatabaseService {
  constructor() {
    // Railway PostgreSQL connection from environment
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
    });

    // Initialize database asynchronously to avoid blocking server startup
    this.initializeDatabase().catch(err => {
      console.error('Database initialization failed, but server will continue:', err.message);
    });
  }

  // Initialize database connection and run migrations
  async initializeDatabase() {
    try {
      // Test connection
      const client = await this.pool.connect();
      console.log('Connected to PostgreSQL database');
      client.release();

      // Run migrations if needed
      await this.runMigrations();
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  // Execute a query with parameters
  async query(text, params = []) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Query executed:', { text: text.substring(0, 100), duration, rows: result.rowCount });
      }
      
      return result;
    } catch (error) {
      console.error('Query error:', { text: text.substring(0, 100), params, error: error.message });
      throw error;
    }
  }

  // Get a client from the pool for transactions
  async getClient() {
    return await this.pool.connect();
  }

  // Execute queries in a transaction
  async transaction(callback) {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Find one record
  async findOne(table, conditions = {}, columns = '*') {
    const whereClause = Object.keys(conditions).map((key, index) => `${key} = $${index + 1}`).join(' AND ');
    const values = Object.values(conditions);
    
    const query = `SELECT ${columns} FROM ${table}${whereClause ? ` WHERE ${whereClause}` : ''} LIMIT 1`;
    const result = await this.query(query, values);
    
    return result.rows[0] || null;
  }

  // Find multiple records
  async findMany(table, conditions = {}, options = {}) {
    const { columns = '*', orderBy = 'created_at DESC', limit, offset } = options;
    
    const whereClause = Object.keys(conditions).map((key, index) => `${key} = $${index + 1}`).join(' AND ');
    const values = Object.values(conditions);
    
    let query = `SELECT ${columns} FROM ${table}`;
    if (whereClause) query += ` WHERE ${whereClause}`;
    if (orderBy) query += ` ORDER BY ${orderBy}`;
    if (limit) query += ` LIMIT ${limit}`;
    if (offset) query += ` OFFSET ${offset}`;
    
    const result = await this.query(query, values);
    return result.rows;
  }

  // Insert a record
  async insert(table, data) {
    const columns = Object.keys(data);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const values = Object.values(data);
    
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await this.query(query, values);
    
    return result.rows[0];
  }

  // Update records
  async update(table, data, conditions) {
    const setClause = Object.keys(data).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const dataValues = Object.values(data);
    
    const whereClause = Object.keys(conditions).map((key, index) => `${key} = $${dataValues.length + index + 1}`).join(' AND ');
    const conditionValues = Object.values(conditions);
    
    const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`;
    const result = await this.query(query, [...dataValues, ...conditionValues]);
    
    return result.rows;
  }

  // Delete records
  async delete(table, conditions) {
    const whereClause = Object.keys(conditions).map((key, index) => `${key} = $${index + 1}`).join(' AND ');
    const values = Object.values(conditions);
    
    const query = `DELETE FROM ${table} WHERE ${whereClause} RETURNING *`;
    const result = await this.query(query, values);
    
    return result.rows;
  }

  // Execute raw SQL with proper error handling
  async raw(sql, params = []) {
    return await this.query(sql, params);
  }

  // Count records
  async count(table, conditions = {}) {
    const whereClause = Object.keys(conditions).map((key, index) => `${key} = $${index + 1}`).join(' AND ');
    const values = Object.values(conditions);
    
    const query = `SELECT COUNT(*) as count FROM ${table}${whereClause ? ` WHERE ${whereClause}` : ''}`;
    const result = await this.query(query, values);
    
    return parseInt(result.rows[0].count);
  }

  // Check if record exists
  async exists(table, conditions) {
    const count = await this.count(table, conditions);
    return count > 0;
  }

  // Run database migrations
  async runMigrations() {
    try {
      // Create migrations table if it doesn't exist
      await this.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // List of migrations to run
      const migrations = [
        {
          name: '001_create_users_table',
          sql: `
            CREATE TABLE IF NOT EXISTS users (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              email VARCHAR(255) UNIQUE NOT NULL,
              password_hash VARCHAR(255) NOT NULL,
              full_name VARCHAR(255),
              phone VARCHAR(20),
              role VARCHAR(50) DEFAULT 'mechanic' CHECK (role IN ('admin', 'shop_manager', 'mechanic')),
              shop_id UUID,
              active BOOLEAN DEFAULT true,
              last_login_at TIMESTAMP,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `
        },
        {
          name: '002_create_user_sessions_table',
          sql: `
            CREATE TABLE IF NOT EXISTS user_sessions (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              refresh_token TEXT NOT NULL,
              expires_at TIMESTAMP NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `
        },
        {
          name: '003_create_shops_table',
          sql: `
            CREATE TABLE IF NOT EXISTS shops (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              name VARCHAR(255) NOT NULL,
              address TEXT,
              phone VARCHAR(20),
              email VARCHAR(255),
              owner_id UUID REFERENCES users(id),
              settings JSONB DEFAULT '{}',
              active BOOLEAN DEFAULT true,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `
        },
        {
          name: '004_create_remaining_tables',
          sql: `
            -- Add shop_id foreign key to users
            ALTER TABLE users ADD CONSTRAINT users_shop_id_fkey 
              FOREIGN KEY (shop_id) REFERENCES shops(id);

            -- Customers table
            CREATE TABLE IF NOT EXISTS customers (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              shop_id UUID REFERENCES shops(id) NOT NULL,
              first_name VARCHAR(255) NOT NULL,
              last_name VARCHAR(255) NOT NULL,
              phone VARCHAR(20) NOT NULL,
              email VARCHAR(255),
              address TEXT,
              notes TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(shop_id, phone)
            );

            -- Vehicles table
            CREATE TABLE IF NOT EXISTS vehicles (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              customer_id UUID REFERENCES customers(id) NOT NULL,
              shop_id UUID REFERENCES shops(id) NOT NULL,
              year INTEGER,
              make VARCHAR(100) NOT NULL,
              model VARCHAR(100) NOT NULL,
              vin VARCHAR(17),
              license_plate VARCHAR(20),
              color VARCHAR(50),
              mileage INTEGER,
              notes TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Inspection templates table
            CREATE TABLE IF NOT EXISTS inspection_templates (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              shop_id UUID REFERENCES shops(id) NOT NULL,
              name VARCHAR(255) NOT NULL,
              description TEXT,
              checklist_items JSONB NOT NULL DEFAULT '[]',
              is_default BOOLEAN DEFAULT false,
              active BOOLEAN DEFAULT true,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Inspections table
            CREATE TABLE IF NOT EXISTS inspections (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              shop_id UUID REFERENCES shops(id) NOT NULL,
              customer_id UUID REFERENCES customers(id) NOT NULL,
              vehicle_id UUID REFERENCES vehicles(id) NOT NULL,
              technician_id UUID REFERENCES users(id) NOT NULL,
              template_id UUID REFERENCES inspection_templates(id),
              inspection_number VARCHAR(50) NOT NULL,
              status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('draft', 'in_progress', 'completed', 'sent', 'archived')),
              checklist_data JSONB DEFAULT '{}',
              overall_condition VARCHAR(20) CHECK (overall_condition IN ('excellent', 'good', 'fair', 'poor')),
              recommendations TEXT,
              notes TEXT,
              started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              completed_at TIMESTAMP,
              sent_at TIMESTAMP,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(shop_id, inspection_number)
            );

            -- Inspection photos table
            CREATE TABLE IF NOT EXISTS inspection_photos (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE NOT NULL,
              file_url TEXT NOT NULL,
              file_path TEXT NOT NULL,
              original_name VARCHAR(255),
              file_size INTEGER,
              mime_type VARCHAR(100),
              category VARCHAR(50),
              description TEXT,
              sort_order INTEGER DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Reports table
            CREATE TABLE IF NOT EXISTS reports (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              inspection_id UUID REFERENCES inspections(id) NOT NULL,
              shop_id UUID REFERENCES shops(id) NOT NULL,
              report_url TEXT,
              short_link VARCHAR(20) UNIQUE,
              pdf_path TEXT,
              html_content TEXT,
              sent_via TEXT[],
              sent_to JSONB DEFAULT '{}',
              sent_at TIMESTAMP,
              viewed_at TIMESTAMP,
              view_count INTEGER DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `
        },
        {
          name: '005_create_indexes',
          sql: `
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_shop_id ON users(shop_id);
            CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);
            CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
            CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id ON vehicles(customer_id);
            CREATE INDEX IF NOT EXISTS idx_vehicles_shop_id ON vehicles(shop_id);
            CREATE INDEX IF NOT EXISTS idx_inspections_shop_id ON inspections(shop_id);
            CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
            CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection_id ON inspection_photos(inspection_id);
            CREATE INDEX IF NOT EXISTS idx_reports_short_link ON reports(short_link);
          `
        }
      ];

      // Execute migrations
      for (const migration of migrations) {
        const exists = await this.findOne('migrations', { name: migration.name });
        if (!exists) {
          console.log(`Running migration: ${migration.name}`);
          await this.query(migration.sql);
          await this.insert('migrations', { name: migration.name });
          console.log(`Migration completed: ${migration.name}`);
        }
      }

      console.log('All migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health');
      return { status: 'healthy', database: 'connected', rows: result.rowCount };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  // Close all connections
  async close() {
    await this.pool.end();
    console.log('Database connections closed');
  }
}

// Export singleton instance
let dbInstance = null;

function createDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseService();
  }
  return dbInstance;
}

module.exports = createDatabase;
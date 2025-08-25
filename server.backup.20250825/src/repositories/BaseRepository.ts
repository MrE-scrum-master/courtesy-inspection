// Base Repository with generic CRUD operations
// Implements Repository Pattern for database access layer

import { DatabaseService, DatabaseClient, QueryOptions, RepositoryOptions, PaginationResult } from '../types/common';

export abstract class BaseRepository<T = any> {
  protected db: DatabaseService;
  protected tableName: string;

  constructor(db: DatabaseService, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  // Find single record by ID
  async findById(id: string, options?: RepositoryOptions): Promise<T | null> {
    try {
      const client = options?.transaction || this.db;
      const result = await client.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName} by id: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Find single record by conditions
  async findOne(conditions: Record<string, any>, options?: RepositoryOptions): Promise<T | null> {
    try {
      const client = options?.transaction || this.db;
      const whereClause = Object.keys(conditions).map((key, index) => `${key} = $${index + 1}`).join(' AND ');
      const values = Object.values(conditions);
      
      const result = await client.query(
        `SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`,
        values
      );
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Find multiple records with pagination
  async findMany(
    conditions: Record<string, any> = {},
    options: RepositoryOptions & { page?: number; limit?: number } = {}
  ): Promise<PaginationResult<T>> {
    try {
      const client = options?.transaction || this.db;
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereConditions = Object.keys(conditions);
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.map((key, index) => `${key} = $${index + 1}`).join(' AND ')}`
        : '';
      const whereValues = Object.values(conditions);

      // Build ORDER BY clause
      const orderBy = options.orderBy || 'created_at DESC';

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`;
      const countResult = await client.query(countQuery, whereValues);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      const dataQuery = `
        SELECT * FROM ${this.tableName} 
        ${whereClause} 
        ORDER BY ${orderBy} 
        LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
      `;
      const dataResult = await client.query(dataQuery, [...whereValues, limit, offset]);

      return {
        items: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName} records: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Create new record
  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>, options?: RepositoryOptions): Promise<T> {
    try {
      const client = options?.transaction || this.db;
      const columns = Object.keys(data);
      const placeholders = columns.map((_, index) => `$${index + 1}`);
      const values = Object.values(data);

      const result = await client.query(
        `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to create ${this.tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Update record by ID
  async updateById(
    id: string, 
    data: Partial<Omit<T, 'id' | 'created_at'>>, 
    options?: RepositoryOptions
  ): Promise<T | null> {
    try {
      const client = options?.transaction || this.db;
      
      // Add updated_at timestamp if the table has this column
      const updateData = { ...data, updated_at: new Date() };
      
      const columns = Object.keys(updateData);
      const setClause = columns.map((key, index) => `${key} = $${index + 1}`).join(', ');
      const values = Object.values(updateData);

      const result = await client.query(
        `UPDATE ${this.tableName} SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id]
      );

      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Failed to update ${this.tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Update records by conditions
  async updateWhere(
    conditions: Record<string, any>,
    data: Partial<Omit<T, 'id' | 'created_at'>>,
    options?: RepositoryOptions
  ): Promise<T[]> {
    try {
      const client = options?.transaction || this.db;
      
      // Add updated_at timestamp
      const updateData = { ...data, updated_at: new Date() };
      
      const updateColumns = Object.keys(updateData);
      const setClause = updateColumns.map((key, index) => `${key} = $${index + 1}`).join(', ');
      const updateValues = Object.values(updateData);

      const whereColumns = Object.keys(conditions);
      const whereClause = whereColumns.map((key, index) => 
        `${key} = $${updateValues.length + index + 1}`
      ).join(' AND ');
      const whereValues = Object.values(conditions);

      const result = await client.query(
        `UPDATE ${this.tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`,
        [...updateValues, ...whereValues]
      );

      return result.rows;
    } catch (error) {
      throw new Error(`Failed to update ${this.tableName} records: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Delete record by ID
  async deleteById(id: string, options?: RepositoryOptions): Promise<boolean> {
    try {
      const client = options?.transaction || this.db;
      const result = await client.query(
        `DELETE FROM ${this.tableName} WHERE id = $1`,
        [id]
      );
      return result.rowCount > 0;
    } catch (error) {
      throw new Error(`Failed to delete ${this.tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Delete records by conditions
  async deleteWhere(conditions: Record<string, any>, options?: RepositoryOptions): Promise<number> {
    try {
      const client = options?.transaction || this.db;
      const whereClause = Object.keys(conditions).map((key, index) => `${key} = $${index + 1}`).join(' AND ');
      const values = Object.values(conditions);

      const result = await client.query(
        `DELETE FROM ${this.tableName} WHERE ${whereClause}`,
        values
      );

      return result.rowCount || 0;
    } catch (error) {
      throw new Error(`Failed to delete ${this.tableName} records: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Check if record exists
  async exists(conditions: Record<string, any>, options?: RepositoryOptions): Promise<boolean> {
    try {
      const client = options?.transaction || this.db;
      const whereClause = Object.keys(conditions).map((key, index) => `${key} = $${index + 1}`).join(' AND ');
      const values = Object.values(conditions);

      const result = await client.query(
        `SELECT 1 FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`,
        values
      );

      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Failed to check ${this.tableName} existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Count records
  async count(conditions: Record<string, any> = {}, options?: RepositoryOptions): Promise<number> {
    try {
      const client = options?.transaction || this.db;
      
      if (Object.keys(conditions).length === 0) {
        const result = await client.query(`SELECT COUNT(*) FROM ${this.tableName}`);
        return parseInt(result.rows[0].count);
      }

      const whereClause = Object.keys(conditions).map((key, index) => `${key} = $${index + 1}`).join(' AND ');
      const values = Object.values(conditions);

      const result = await client.query(
        `SELECT COUNT(*) FROM ${this.tableName} WHERE ${whereClause}`,
        values
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      throw new Error(`Failed to count ${this.tableName} records: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Execute custom query
  async executeQuery(query: string, params: any[] = [], options?: RepositoryOptions): Promise<any[]> {
    try {
      const client = options?.transaction || this.db;
      const result = await client.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to execute query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Begin transaction and execute callback
  async withTransaction<R>(callback: (transaction: DatabaseClient) => Promise<R>): Promise<R> {
    return await this.db.transaction(callback);
  }
}
// User Repository - Database access layer for user operations
// Extends BaseRepository with user-specific queries

import { BaseRepository } from './BaseRepository';
import { User } from '../types/entities';
import { DatabaseService, RepositoryOptions } from '../types/common';

export class UserRepository extends BaseRepository<User> {
  constructor(db: DatabaseService) {
    super(db, 'users');
  }

  // Find user by email (for authentication)
  async findByEmail(email: string, options?: RepositoryOptions): Promise<User | null> {
    try {
      const client = options?.transaction || this.db;
      const result = await client.query(
        'SELECT * FROM users WHERE email = $1 AND active = true LIMIT 1',
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Failed to find user by email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Find user with shop information
  async findByIdWithShop(id: string, options?: RepositoryOptions): Promise<(User & { shop_name?: string }) | null> {
    try {
      const client = options?.transaction || this.db;
      const result = await client.query(
        `SELECT u.*, s.name as shop_name 
         FROM users u 
         LEFT JOIN shops s ON u.shop_id = s.id 
         WHERE u.id = $1 AND u.active = true 
         LIMIT 1`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Failed to find user with shop: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Find users by shop ID
  async findByShopId(shopId: string, options?: RepositoryOptions): Promise<User[]> {
    try {
      const client = options?.transaction || this.db;
      const result = await client.query(
        `SELECT * FROM users 
         WHERE shop_id = $1 AND active = true 
         ORDER BY role, full_name`,
        [shopId]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to find users by shop: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Find users by role
  async findByRole(role: string, shopId?: string, options?: RepositoryOptions): Promise<User[]> {
    try {
      const client = options?.transaction || this.db;
      
      let query = 'SELECT * FROM users WHERE role = $1 AND active = true';
      let params: any[] = [role];
      
      if (shopId) {
        query += ' AND shop_id = $2';
        params.push(shopId);
      }
      
      query += ' ORDER BY full_name';
      
      const result = await client.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to find users by role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Update last login timestamp
  async updateLastLogin(userId: string, options?: RepositoryOptions): Promise<void> {
    try {
      const client = options?.transaction || this.db;
      await client.query(
        'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
        [userId]
      );
    } catch (error) {
      throw new Error(`Failed to update last login: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Check if email exists (for registration validation)
  async emailExists(email: string, excludeUserId?: string, options?: RepositoryOptions): Promise<boolean> {
    try {
      const client = options?.transaction || this.db;
      
      let query = 'SELECT 1 FROM users WHERE email = $1';
      let params: any[] = [email];
      
      if (excludeUserId) {
        query += ' AND id != $2';
        params.push(excludeUserId);
      }
      
      query += ' LIMIT 1';
      
      const result = await client.query(query, params);
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Failed to check email existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Find active users with pagination and search
  async findActiveUsersWithSearch(
    searchTerm?: string,
    shopId?: string,
    role?: string,
    page: number = 1,
    limit: number = 20,
    options?: RepositoryOptions
  ): Promise<{ users: (User & { shop_name?: string })[]; total: number }> {
    try {
      const client = options?.transaction || this.db;
      const offset = (page - 1) * limit;
      
      let whereConditions: string[] = ['u.active = true'];
      let params: any[] = [];
      let paramIndex = 1;

      // Add search condition
      if (searchTerm) {
        whereConditions.push(`(u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
        params.push(`%${searchTerm}%`);
        paramIndex++;
      }

      // Add shop filter
      if (shopId) {
        whereConditions.push(`u.shop_id = $${paramIndex}`);
        params.push(shopId);
        paramIndex++;
      }

      // Add role filter
      if (role) {
        whereConditions.push(`u.role = $${paramIndex}`);
        params.push(role);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countQuery = `
        SELECT COUNT(*) 
        FROM users u 
        WHERE ${whereClause}
      `;
      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      const dataQuery = `
        SELECT u.*, s.name as shop_name
        FROM users u
        LEFT JOIN shops s ON u.shop_id = s.id
        WHERE ${whereClause}
        ORDER BY u.role, u.full_name
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      const dataResult = await client.query(dataQuery, [...params, limit, offset]);

      return {
        users: dataResult.rows,
        total
      };
    } catch (error) {
      throw new Error(`Failed to find users with search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Deactivate user (soft delete)
  async deactivate(userId: string, options?: RepositoryOptions): Promise<boolean> {
    try {
      const client = options?.transaction || this.db;
      const result = await client.query(
        'UPDATE users SET active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
        [userId]
      );
      return result.rowCount > 0;
    } catch (error) {
      throw new Error(`Failed to deactivate user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Reactivate user
  async reactivate(userId: string, options?: RepositoryOptions): Promise<boolean> {
    try {
      const client = options?.transaction || this.db;
      const result = await client.query(
        'UPDATE users SET active = true, updated_at = NOW() WHERE id = $1 RETURNING id',
        [userId]
      );
      return result.rowCount > 0;
    } catch (error) {
      throw new Error(`Failed to reactivate user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Update user password
  async updatePassword(userId: string, hashedPassword: string, options?: RepositoryOptions): Promise<boolean> {
    try {
      const client = options?.transaction || this.db;
      const result = await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
        [hashedPassword, userId]
      );
      return result.rowCount > 0;
    } catch (error) {
      throw new Error(`Failed to update password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
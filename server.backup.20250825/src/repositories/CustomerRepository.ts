// Customer Repository - Database access layer for customer operations
// Handles customer data with vehicle relationships

import { BaseRepository } from './BaseRepository';
import { Customer } from '../types/entities';
import { DatabaseService, RepositoryOptions } from '../types/common';

export class CustomerRepository extends BaseRepository<Customer> {
  constructor(db: DatabaseService) {
    super(db, 'customers');
  }

  // Find customer with their vehicles
  async findByIdWithVehicles(id: string, options?: RepositoryOptions): Promise<any | null> {
    try {
      const client = options?.transaction || this.db;
      
      // First get customer
      const customerResult = await client.query(
        'SELECT * FROM customers WHERE id = $1 LIMIT 1',
        [id]
      );
      
      if (customerResult.rows.length === 0) {
        return null;
      }

      const customer = customerResult.rows[0];

      // Get vehicles
      const vehiclesResult = await client.query(
        'SELECT * FROM vehicles WHERE customer_id = $1 ORDER BY created_at DESC',
        [id]
      );

      return {
        ...customer,
        vehicles: vehiclesResult.rows
      };
    } catch (error) {
      throw new Error(`Failed to find customer with vehicles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Find customers by shop with search and pagination
  async findByShopWithSearch(
    shopId: string,
    searchTerm?: string,
    page: number = 1,
    limit: number = 20,
    options?: RepositoryOptions
  ): Promise<{ customers: Customer[]; total: number }> {
    try {
      const client = options?.transaction || this.db;
      const offset = (page - 1) * limit;
      
      let whereConditions: string[] = ['shop_id = $1'];
      let params: any[] = [shopId];
      let paramIndex = 2;

      // Add search condition
      if (searchTerm) {
        whereConditions.push(`(
          first_name ILIKE $${paramIndex} OR 
          last_name ILIKE $${paramIndex} OR 
          phone ILIKE $${paramIndex} OR 
          email ILIKE $${paramIndex}
        )`);
        params.push(`%${searchTerm}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM customers WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      const dataQuery = `
        SELECT * FROM customers 
        WHERE ${whereClause}
        ORDER BY last_name, first_name
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      const dataResult = await client.query(dataQuery, [...params, limit, offset]);

      return {
        customers: dataResult.rows,
        total
      };
    } catch (error) {
      throw new Error(`Failed to find customers with search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Find customer by phone number (for duplicate checking)
  async findByPhone(shopId: string, phone: string, excludeCustomerId?: string, options?: RepositoryOptions): Promise<Customer | null> {
    try {
      const client = options?.transaction || this.db;
      
      let query = 'SELECT * FROM customers WHERE shop_id = $1 AND phone = $2';
      let params: any[] = [shopId, phone];
      
      if (excludeCustomerId) {
        query += ' AND id != $3';
        params.push(excludeCustomerId);
      }
      
      query += ' LIMIT 1';
      
      const result = await client.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Failed to find customer by phone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Check if phone number exists in shop
  async phoneExists(shopId: string, phone: string, excludeCustomerId?: string, options?: RepositoryOptions): Promise<boolean> {
    try {
      const customer = await this.findByPhone(shopId, phone, excludeCustomerId, options);
      return customer !== null;
    } catch (error) {
      throw new Error(`Failed to check phone existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Find customers with recent activity (inspections)
  async findWithRecentActivity(
    shopId: string,
    days: number = 30,
    limit: number = 10,
    options?: RepositoryOptions
  ): Promise<any[]> {
    try {
      const client = options?.transaction || this.db;
      const result = await client.query(
        `SELECT 
          c.*,
          i.started_at as last_inspection_date,
          COUNT(i.id) as inspection_count
         FROM customers c
         LEFT JOIN inspections i ON c.id = i.customer_id AND i.started_at >= NOW() - INTERVAL '${days} days'
         WHERE c.shop_id = $1
         GROUP BY c.id, i.started_at
         HAVING COUNT(i.id) > 0
         ORDER BY i.started_at DESC
         LIMIT $2`,
        [shopId, limit]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to find customers with recent activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get customer statistics
  async getCustomerStatistics(customerId: string, options?: RepositoryOptions): Promise<any> {
    try {
      const client = options?.transaction || this.db;
      const result = await client.query(
        `SELECT 
          COUNT(v.id) as vehicle_count,
          COUNT(i.id) as inspection_count,
          COUNT(CASE WHEN i.status = 'completed' THEN 1 END) as completed_inspections,
          MAX(i.started_at) as last_inspection_date,
          COUNT(CASE WHEN i.overall_condition = 'poor' THEN 1 END) as poor_condition_count
         FROM customers c
         LEFT JOIN vehicles v ON c.id = v.customer_id
         LEFT JOIN inspections i ON v.id = i.vehicle_id
         WHERE c.id = $1
         GROUP BY c.id`,
        [customerId]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get customer statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Find customers due for service (based on last inspection date)
  async findDueForService(
    shopId: string,
    monthsThreshold: number = 6,
    limit: number = 20,
    options?: RepositoryOptions
  ): Promise<any[]> {
    try {
      const client = options?.transaction || this.db;
      const result = await client.query(
        `SELECT 
          c.*,
          v.year || ' ' || v.make || ' ' || v.model as vehicle_info,
          MAX(i.started_at) as last_inspection_date,
          COUNT(i.id) as total_inspections
         FROM customers c
         JOIN vehicles v ON c.id = v.customer_id
         LEFT JOIN inspections i ON v.id = i.vehicle_id
         WHERE c.shop_id = $1
         GROUP BY c.id, v.id, v.year, v.make, v.model
         HAVING (
           MAX(i.started_at) IS NULL OR 
           MAX(i.started_at) < NOW() - INTERVAL '${monthsThreshold} months'
         )
         ORDER BY MAX(i.started_at) ASC NULLS FIRST
         LIMIT $2`,
        [shopId, limit]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to find customers due for service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Search customers across multiple fields
  async searchCustomers(
    shopId: string,
    searchTerm: string,
    limit: number = 10,
    options?: RepositoryOptions
  ): Promise<any[]> {
    try {
      const client = options?.transaction || this.db;
      
      // Clean search term
      const cleanTerm = searchTerm.trim().replace(/\s+/g, ' ');
      
      const result = await client.query(
        `SELECT 
          c.*,
          COUNT(v.id) as vehicle_count,
          ts_rank_cd(
            to_tsvector('english', c.first_name || ' ' || c.last_name || ' ' || COALESCE(c.phone, '') || ' ' || COALESCE(c.email, '')), 
            plainto_tsquery('english', $2)
          ) as rank
         FROM customers c
         LEFT JOIN vehicles v ON c.id = v.customer_id
         WHERE c.shop_id = $1 AND (
           c.first_name ILIKE $3 OR
           c.last_name ILIKE $3 OR
           c.phone ILIKE $3 OR
           c.email ILIKE $3 OR
           (c.first_name || ' ' || c.last_name) ILIKE $3
         )
         GROUP BY c.id
         ORDER BY rank DESC, c.last_name, c.first_name
         LIMIT $4`,
        [shopId, cleanTerm, `%${cleanTerm}%`, limit]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to search customers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get customer contact information for notifications
  async getContactInfo(customerId: string, options?: RepositoryOptions): Promise<{ phone: string; email?: string; name: string } | null> {
    try {
      const client = options?.transaction || this.db;
      const result = await client.query(
        'SELECT first_name, last_name, phone, email FROM customers WHERE id = $1 LIMIT 1',
        [customerId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }

      const customer = result.rows[0];
      return {
        name: `${customer.first_name} ${customer.last_name}`,
        phone: customer.phone,
        email: customer.email
      };
    } catch (error) {
      throw new Error(`Failed to get customer contact info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
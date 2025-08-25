/**
 * Integration tests for Inspection API endpoints
 * Tests complete inspection CRUD operations with real database
 */

import request from 'supertest';
import { Express } from 'express';
import { TestDatabase, TestDataFactory, TestAuth } from '../utils/test-setup';
import { createApp } from '../../src/server';

describe('Inspections API Integration', () => {
  let app: Express;
  let testData: any;
  let mechanicToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = createApp();
    await TestDatabase.setup();
  });

  beforeEach(async () => {
    await TestDatabase.clearTables();
    testData = await TestDatabase.seedTestData();
    
    mechanicToken = TestAuth.generateTestToken({
      userId: testData.mechanicId,
      email: 'mechanic@test.com',
      role: 'mechanic',
      shopId: testData.shopId
    });

    adminToken = TestAuth.generateTestToken({
      userId: testData.adminId,
      email: 'admin@test.com',
      role: 'admin',
      shopId: testData.shopId
    });
  });

  afterAll(async () => {
    await TestDatabase.cleanup();
  });

  describe('POST /api/inspections', () => {
    it('should create new inspection successfully', async () => {
      // Arrange
      const inspectionData = {
        customer_id: testData.customerId,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard'
      };

      // Act
      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(inspectionData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.inspection).toBeDefined();
      expect(response.body.inspection.id).toBeDefined();
      expect(response.body.inspection.inspection_number).toMatch(/24-\d{4}/);
      expect(response.body.inspection.status).toBe('in_progress');
      expect(response.body.inspection.technician_id).toBe(testData.mechanicId);
      expect(response.body.inspection.shop_id).toBe(testData.shopId);
      expect(response.body.inspection.customer_id).toBe(testData.customerId);
    });

    it('should validate VIN format', async () => {
      // Arrange
      const inspectionData = {
        customer_id: testData.customerId,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: 'INVALID_VIN_FORMAT',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard'
      };

      // Act
      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(inspectionData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid VIN format');
    });

    it('should validate customer belongs to same shop', async () => {
      // Arrange - Create customer in different shop
      const differentShopCustomer = await TestDatabase.seedTestData(); // Different shop
      const inspectionData = {
        customer_id: differentShopCustomer.customerId,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard'
      };

      // Act
      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(inspectionData)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Customer not found in your shop');
    });

    it('should validate required fields', async () => {
      // Arrange
      const incompleteData = {
        customer_id: testData.customerId,
        vehicle_make: 'Toyota'
        // Missing required fields
      };

      // Act
      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(incompleteData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation error');
    });

    it('should validate mileage range', async () => {
      // Arrange
      const inspectionData = {
        customer_id: testData.customerId,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: -1000, // Invalid negative mileage
        license_plate: 'ABC123',
        inspection_type: 'standard'
      };

      // Act
      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(inspectionData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid mileage');
    });

    it('should auto-generate inspection number', async () => {
      // Arrange
      const inspectionData1 = {
        customer_id: testData.customerId,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard'
      };

      const inspectionData2 = {
        ...inspectionData1,
        vehicle_vin: '2HGBH41JXMN109186',
        license_plate: 'DEF456'
      };

      // Act
      const response1 = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(inspectionData1)
        .expect(201);

      const response2 = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(inspectionData2)
        .expect(201);

      // Assert
      expect(response1.body.inspection.inspection_number).toBeDefined();
      expect(response2.body.inspection.inspection_number).toBeDefined();
      expect(response1.body.inspection.inspection_number).not.toBe(
        response2.body.inspection.inspection_number
      );
    });
  });

  describe('GET /api/inspections', () => {
    let inspection1: any;
    let inspection2: any;

    beforeEach(async () => {
      // Create test inspections
      const inspectionData1 = {
        customer_id: testData.customerId,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard'
      };

      const inspectionData2 = {
        ...inspectionData1,
        vehicle_make: 'Honda',
        vehicle_model: 'Civic',
        vehicle_vin: '2HGBH41JXMN109186',
        license_plate: 'DEF456',
        inspection_type: 'comprehensive'
      };

      const response1 = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(inspectionData1);

      const response2 = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(inspectionData2);

      inspection1 = response1.body.inspection;
      inspection2 = response2.body.inspection;
    });

    it('should return paginated list of inspections', async () => {
      // Act
      const response = await request(app)
        .get('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.inspections).toBeDefined();
      expect(Array.isArray(response.body.inspections)).toBe(true);
      expect(response.body.inspections.length).toBe(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
    });

    it('should filter inspections by status', async () => {
      // Arrange - Update one inspection status
      await request(app)
        .patch(`/api/inspections/${inspection1.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'completed' });

      // Act
      const response = await request(app)
        .get('/api/inspections?status=completed')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.inspections).toHaveLength(1);
      expect(response.body.inspections[0].status).toBe('completed');
    });

    it('should filter inspections by inspection type', async () => {
      // Act
      const response = await request(app)
        .get('/api/inspections?inspection_type=comprehensive')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.inspections).toHaveLength(1);
      expect(response.body.inspections[0].inspection_type).toBe('comprehensive');
    });

    it('should support pagination parameters', async () => {
      // Act
      const response = await request(app)
        .get('/api/inspections?page=1&limit=1')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.inspections).toHaveLength(1);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.hasMore).toBe(true);
    });

    it('should sort inspections by creation date descending by default', async () => {
      // Act
      const response = await request(app)
        .get('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      const inspections = response.body.inspections;
      for (let i = 1; i < inspections.length; i++) {
        const current = new Date(inspections[i].created_at);
        const previous = new Date(inspections[i - 1].created_at);
        expect(current.getTime()).toBeLessThanOrEqual(previous.getTime());
      }
    });

    it('should only return inspections from user shop', async () => {
      // Act
      const response = await request(app)
        .get('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      response.body.inspections.forEach((inspection: any) => {
        expect(inspection.shop_id).toBe(testData.shopId);
      });
    });
  });

  describe('GET /api/inspections/:id', () => {
    let inspectionId: string;

    beforeEach(async () => {
      const inspectionData = {
        customer_id: testData.customerId,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard'
      };

      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(inspectionData);

      inspectionId = response.body.inspection.id;
    });

    it('should return inspection details', async () => {
      // Act
      const response = await request(app)
        .get(`/api/inspections/${inspectionId}`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.inspection).toBeDefined();
      expect(response.body.inspection.id).toBe(inspectionId);
      expect(response.body.inspection.customer).toBeDefined(); // Should include customer details
      expect(response.body.inspection.technician).toBeDefined(); // Should include technician details
    });

    it('should return 404 for non-existent inspection', async () => {
      // Act
      const response = await request(app)
        .get('/api/inspections/non-existent-id')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Inspection not found');
    });

    it('should prevent access to inspections from other shops', async () => {
      // Arrange - Create token for different shop
      const differentShopToken = TestAuth.generateTestToken({
        userId: 'different-user-id',
        email: 'different@shop.com',
        role: 'mechanic',
        shopId: 'different-shop-id'
      });

      // Act
      const response = await request(app)
        .get(`/api/inspections/${inspectionId}`)
        .set('Authorization', `Bearer ${differentShopToken}`)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Not authorized');
    });
  });

  describe('PATCH /api/inspections/:id/status', () => {
    let inspectionId: string;

    beforeEach(async () => {
      const inspectionData = {
        customer_id: testData.customerId,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard'
      };

      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(inspectionData);

      inspectionId = response.body.inspection.id;
    });

    it('should update inspection status successfully', async () => {
      // Arrange
      const statusUpdate = {
        status: 'pending_approval',
        notes: 'Inspection completed, ready for review'
      };

      // Act
      const response = await request(app)
        .patch(`/api/inspections/${inspectionId}/status`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(statusUpdate)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.inspection.status).toBe('pending_approval');
      expect(response.body.inspection.updated_at).toBeDefined();
    });

    it('should validate status transitions', async () => {
      // Arrange - Try invalid transition
      const invalidStatusUpdate = {
        status: 'completed' // Cannot go directly from in_progress to completed
      };

      // Act
      const response = await request(app)
        .patch(`/api/inspections/${inspectionId}/status`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(invalidStatusUpdate)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid status transition');
    });

    it('should enforce role permissions for status changes', async () => {
      // Arrange - Try to approve as mechanic (should require manager)
      const approvalUpdate = {
        status: 'approved'
      };

      // First, move to pending_approval
      await request(app)
        .patch(`/api/inspections/${inspectionId}/status`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send({ status: 'pending_approval' });

      // Act - Try to approve as mechanic
      const response = await request(app)
        .patch(`/api/inspections/${inspectionId}/status`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(approvalUpdate)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should allow manager to approve inspection', async () => {
      // Arrange
      const approvalUpdate = {
        status: 'approved',
        notes: 'Approved by manager'
      };

      // First, move to pending_approval
      await request(app)
        .patch(`/api/inspections/${inspectionId}/status`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send({ status: 'pending_approval' });

      // Act - Approve as admin/manager
      const response = await request(app)
        .patch(`/api/inspections/${inspectionId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(approvalUpdate)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.inspection.status).toBe('approved');
    });

    it('should update workflow history on status change', async () => {
      // Arrange
      const statusUpdate = {
        status: 'pending_approval',
        notes: 'Ready for review'
      };

      // Act
      const response = await request(app)
        .patch(`/api/inspections/${inspectionId}/status`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(statusUpdate)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.workflow_updated).toBe(true);

      // Verify workflow history
      const historyResponse = await request(app)
        .get(`/api/inspections/${inspectionId}/workflow-history`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .expect(200);

      expect(historyResponse.body.history.length).toBeGreaterThan(1);
    });
  });

  describe('PUT /api/inspections/:id', () => {
    let inspectionId: string;

    beforeEach(async () => {
      const inspectionData = {
        customer_id: testData.customerId,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard'
      };

      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(inspectionData);

      inspectionId = response.body.inspection.id;
    });

    it('should update inspection details', async () => {
      // Arrange
      const updateData = {
        mileage: 47000,
        notes: 'Updated mileage after verification',
        checklist_data: {
          brakes: {
            brake_pads: { status: 'good', notes: 'Recently replaced' },
            brake_fluid: { status: 'needs_service', notes: 'Low level' }
          }
        }
      };

      // Act
      const response = await request(app)
        .put(`/api/inspections/${inspectionId}`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.inspection.mileage).toBe(47000);
      expect(response.body.inspection.notes).toBe('Updated mileage after verification');
      expect(response.body.inspection.checklist_data).toBeDefined();
      expect(response.body.inspection.checklist_data.brakes.brake_pads.status).toBe('good');
    });

    it('should not allow updating immutable fields', async () => {
      // Arrange
      const updateData = {
        id: 'different-id',
        inspection_number: 'HACKED-001',
        created_at: new Date().toISOString(),
        shop_id: 'different-shop'
      };

      // Act
      const response = await request(app)
        .put(`/api/inspections/${inspectionId}`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(updateData)
        .expect(200);

      // Assert - Immutable fields should not change
      expect(response.body.inspection.id).toBe(inspectionId);
      expect(response.body.inspection.shop_id).toBe(testData.shopId);
      expect(response.body.inspection.inspection_number).not.toBe('HACKED-001');
    });

    it('should validate checklist data structure', async () => {
      // Arrange
      const updateData = {
        checklist_data: {
          invalid_category: { // Invalid category
            some_item: { status: 'unknown_status' } // Invalid status
          }
        }
      };

      // Act
      const response = await request(app)
        .put(`/api/inspections/${inspectionId}`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(updateData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid checklist data');
    });
  });

  describe('DELETE /api/inspections/:id', () => {
    let inspectionId: string;

    beforeEach(async () => {
      const inspectionData = {
        customer_id: testData.customerId,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard'
      };

      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(inspectionData);

      inspectionId = response.body.inspection.id;
    });

    it('should soft delete inspection', async () => {
      // Act
      const response = await request(app)
        .delete(`/api/inspections/${inspectionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Inspection deleted successfully');

      // Verify inspection is not returned in normal queries
      const listResponse = await request(app)
        .get('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .expect(200);

      const deletedInspection = listResponse.body.inspections.find(
        (inspection: any) => inspection.id === inspectionId
      );
      expect(deletedInspection).toBeUndefined();
    });

    it('should require admin permissions to delete', async () => {
      // Act
      const response = await request(app)
        .delete(`/api/inspections/${inspectionId}`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should prevent deletion of completed inspections', async () => {
      // Arrange - Complete the inspection
      await request(app)
        .patch(`/api/inspections/${inspectionId}/status`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send({ status: 'pending_approval' });

      await request(app)
        .patch(`/api/inspections/${inspectionId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });

      await request(app)
        .patch(`/api/inspections/${inspectionId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'completed' });

      // Act
      const response = await request(app)
        .delete(`/api/inspections/${inspectionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Cannot delete completed inspection');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      // Act
      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid JSON');
    });

    it('should handle concurrent updates properly', async () => {
      // Arrange - Create inspection
      const inspectionData = {
        customer_id: testData.customerId,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard'
      };

      const createResponse = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(inspectionData);

      const inspectionId = createResponse.body.inspection.id;

      // Act - Concurrent updates
      const updatePromises = [
        request(app)
          .put(`/api/inspections/${inspectionId}`)
          .set('Authorization', `Bearer ${mechanicToken}`)
          .send({ mileage: 46000 }),
        
        request(app)
          .put(`/api/inspections/${inspectionId}`)
          .set('Authorization', `Bearer ${mechanicToken}`)
          .send({ mileage: 47000 })
      ];

      const responses = await Promise.all(updatePromises);

      // Assert - At least one should succeed
      const successfulUpdates = responses.filter(r => r.status === 200);
      expect(successfulUpdates.length).toBeGreaterThanOrEqual(1);
    });

    it('should validate request size limits', async () => {
      // Arrange - Create very large payload
      const largePayload = {
        customer_id: testData.customerId,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard',
        notes: 'A'.repeat(10000) // Very large notes field
      };

      // Act
      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send(largePayload);

      // Assert - Should either succeed or fail with proper error
      if (response.status === 413) {
        expect(response.body.error).toContain('Request entity too large');
      } else if (response.status === 400) {
        expect(response.body.error).toContain('Notes too long');
      }
    });
  });
});
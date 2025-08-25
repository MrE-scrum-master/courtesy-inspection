/**
 * E2E Test: Mechanic Inspection Flow
 * Tests the complete inspection workflow from a mechanic's perspective
 */

import { test, expect, Page } from '@playwright/test';
import { AuthHelper } from '../helpers/auth-helper';
import { InspectionHelper } from '../helpers/inspection-helper';
import { DataHelper } from '../helpers/data-helper';

test.describe('Mechanic Inspection Flow', () => {
  let authHelper: AuthHelper;
  let inspectionHelper: InspectionHelper;
  let dataHelper: DataHelper;
  
  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    inspectionHelper = new InspectionHelper(page);
    dataHelper = new DataHelper(page);
    
    // Set up test data
    await dataHelper.setupTestEnvironment();
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await dataHelper.cleanupTestData();
  });

  test('should complete full inspection workflow', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes for full flow
    
    // Step 1: Login as mechanic
    await test.step('Login as mechanic', async () => {
      await authHelper.loginAsMechanic();
      await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-role"]')).toContainText('Mechanic');
    });

    // Step 2: Navigate to create inspection
    await test.step('Navigate to create inspection', async () => {
      await page.click('[data-testid="create-inspection-btn"]');
      await expect(page.locator('[data-testid="create-inspection-form"]')).toBeVisible();
    });

    // Step 3: Fill inspection details
    let inspectionId: string;
    await test.step('Fill inspection details', async () => {
      // Select customer
      await page.click('[data-testid="customer-select"]');
      await page.click('[data-testid="customer-option-john-doe"]');
      
      // Fill vehicle information
      await page.fill('[data-testid="vehicle-make"]', 'Toyota');
      await page.fill('[data-testid="vehicle-model"]', 'Camry');
      await page.fill('[data-testid="vehicle-year"]', '2020');
      await page.fill('[data-testid="vehicle-vin"]', '1HGBH41JXMN109186');
      await page.fill('[data-testid="mileage"]', '45000');
      await page.fill('[data-testid="license-plate"]', 'TEST123');
      
      // Select inspection type
      await page.selectOption('[data-testid="inspection-type"]', 'standard');
      
      // Submit form
      await page.click('[data-testid="create-inspection-submit"]');
      
      // Wait for success and capture inspection ID
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      const inspectionNumber = await page.locator('[data-testid="inspection-number"]').textContent();
      expect(inspectionNumber).toMatch(/24-\d{4}/);
      
      // Navigate to inspection details
      await page.click('[data-testid="view-inspection-btn"]');
      inspectionId = await page.url().split('/').pop() || '';
      expect(inspectionId).toBeTruthy();
    });

    // Step 4: Perform inspection checklist
    await test.step('Perform inspection checklist', async () => {
      await expect(page.locator('[data-testid="inspection-checklist"]')).toBeVisible();
      
      // Brakes section
      await page.click('[data-testid="category-brakes"]');
      await page.selectOption('[data-testid="brake-pads-status"]', 'good');
      await page.fill('[data-testid="brake-pads-notes"]', 'Brake pads in excellent condition, 80% thickness remaining');
      
      await page.selectOption('[data-testid="brake-fluid-status"]', 'needs_attention');
      await page.fill('[data-testid="brake-fluid-notes"]', 'Brake fluid level slightly low, recommend topping off');
      
      // Engine section
      await page.click('[data-testid="category-engine"]');
      await page.selectOption('[data-testid="oil-level-status"]', 'good');
      await page.fill('[data-testid="oil-level-notes"]', 'Oil level good, clean oil, recently changed');
      
      await page.selectOption('[data-testid="air-filter-status"]', 'needs_service');
      await page.fill('[data-testid="air-filter-notes"]', 'Air filter dirty, recommend replacement within 1000 miles');
      
      // Tires section
      await page.click('[data-testid="category-tires"]');
      await page.selectOption('[data-testid="tire-tread-status"]', 'fair');
      await page.fill('[data-testid="tire-tread-notes"]', 'Front tires at 4/32" tread depth, monitor closely');
      
      // Save progress
      await page.click('[data-testid="save-progress-btn"]');
      await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
    });

    // Step 5: Add photos
    await test.step('Add inspection photos', async () => {
      await page.click('[data-testid="add-photos-tab"]');
      
      // Upload brake photo
      await page.setInputFiles('[data-testid="photo-upload"]', './test-assets/brake-photo.jpg');
      await page.fill('[data-testid="photo-description"]', 'Brake pad condition - front left');
      await page.selectOption('[data-testid="photo-category"]', 'brakes');
      await page.click('[data-testid="upload-photo-btn"]');
      
      await expect(page.locator('[data-testid="photo-thumbnail"]')).toBeVisible();
      
      // Upload engine photo
      await page.setInputFiles('[data-testid="photo-upload"]', './test-assets/engine-photo.jpg');
      await page.fill('[data-testid="photo-description"]', 'Engine bay overview');
      await page.selectOption('[data-testid="photo-category"]', 'engine');
      await page.click('[data-testid="upload-photo-btn"]');
      
      // Verify photos uploaded
      const photoCount = await page.locator('[data-testid="photo-thumbnail"]').count();
      expect(photoCount).toBe(2);
    });

    // Step 6: Use voice input for additional notes
    await test.step('Add voice notes', async () => {
      // Mock voice input (in real implementation, this would test actual voice recording)
      await page.click('[data-testid="voice-input-btn"]');
      await page.waitForSelector('[data-testid="voice-recording-indicator"]');
      
      // Simulate voice input completion
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('voiceInputComplete', {
          detail: {
            transcript: 'Overall vehicle condition is good, customer drives mostly highway miles, recommend brake fluid top-off and air filter replacement',
            confidence: 0.95
          }
        }));
      });
      
      await expect(page.locator('[data-testid="voice-transcript"]')).toBeVisible();
      await expect(page.locator('[data-testid="voice-transcript"]')).toContainText('brake fluid');
    });

    // Step 7: Generate inspection summary
    await test.step('Generate inspection summary', async () => {
      await page.click('[data-testid="generate-summary-btn"]');
      await expect(page.locator('[data-testid="inspection-summary"]')).toBeVisible();
      
      // Verify summary contains key information
      const summary = page.locator('[data-testid="summary-content"]');
      await expect(summary).toContainText('items inspected');
      await expect(summary).toContainText('needs attention');
      await expect(summary).toContainText('brake fluid');
      await expect(summary).toContainText('air filter');
    });

    // Step 8: Submit for approval
    await test.step('Submit inspection for approval', async () => {
      await page.click('[data-testid="submit-approval-btn"]');
      
      // Confirm submission
      await page.click('[data-testid="confirm-submit-btn"]');
      
      // Verify status change
      await expect(page.locator('[data-testid="inspection-status"]')).toContainText('Pending Approval');
      await expect(page.locator('[data-testid="success-message"]')).toContainText('submitted for approval');
      
      // Verify inspection appears in pending list
      await page.click('[data-testid="nav-dashboard"]');
      await expect(page.locator('[data-testid="pending-approvals-count"]')).toContainText('1');
    });

    // Step 9: Verify workflow history
    await test.step('Verify workflow history', async () => {
      await page.click(`[data-testid="inspection-${inspectionId}"]`);
      await page.click('[data-testid="workflow-history-tab"]');
      
      const historyEntries = page.locator('[data-testid="workflow-entry"]');
      await expect(historyEntries).toHaveCount(2); // Created + Submitted for approval
      
      await expect(historyEntries.first()).toContainText('Created');
      await expect(historyEntries.last()).toContainText('Submitted for approval');
    });
  });

  test('should handle inspection with critical issues', async ({ page }) => {
    // Login as mechanic
    await authHelper.loginAsMechanic();
    
    // Create inspection with critical findings
    await test.step('Create inspection with critical issues', async () => {
      await inspectionHelper.createBasicInspection();
      
      // Mark critical brake issue
      await page.click('[data-testid="category-brakes"]');
      await page.selectOption('[data-testid="brake-pads-status"]', 'critical');
      await page.fill('[data-testid="brake-pads-notes"]', 'CRITICAL: Brake pads completely worn, metal-to-metal contact, immediate replacement required');
      
      // Mark safety concern
      await page.check('[data-testid="safety-concern-checkbox"]');
      await page.selectOption('[data-testid="urgency-level"]', 'critical');
      
      await page.click('[data-testid="save-progress-btn"]');
    });

    // Verify critical issue indicators
    await test.step('Verify critical issue indicators', async () => {
      await expect(page.locator('[data-testid="critical-alert"]')).toBeVisible();
      await expect(page.locator('[data-testid="safety-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="do-not-drive-warning"]')).toBeVisible();
    });

    // Submit with critical issues
    await test.step('Submit inspection with critical issues', async () => {
      await page.click('[data-testid="submit-approval-btn"]');
      
      // Should show critical issue confirmation
      await expect(page.locator('[data-testid="critical-confirmation-modal"]')).toBeVisible();
      await page.check('[data-testid="acknowledge-critical-checkbox"]');
      await page.click('[data-testid="confirm-critical-submit"]');
      
      // Verify immediate escalation
      await expect(page.locator('[data-testid="critical-escalated-message"]')).toBeVisible();
    });
  });

  test('should support offline mode and sync', async ({ page }) => {
    // Login and start inspection
    await authHelper.loginAsMechanic();
    const inspectionId = await inspectionHelper.createBasicInspection();
    
    // Simulate going offline
    await test.step('Work offline', async () => {
      await page.context().setOffline(true);
      
      // Make changes offline
      await page.selectOption('[data-testid="brake-pads-status"]', 'good');
      await page.fill('[data-testid="brake-pads-notes"]', 'Offline note: brakes look good');
      
      await page.click('[data-testid="save-progress-btn"]');
      
      // Verify offline indicator
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="pending-sync-count"]')).toContainText('1');
    });

    // Come back online and sync
    await test.step('Sync when online', async () => {
      await page.context().setOffline(false);
      
      // Wait for auto-sync or trigger manual sync
      await page.click('[data-testid="sync-now-btn"]');
      
      // Verify sync completion
      await expect(page.locator('[data-testid="sync-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="pending-sync-count"]')).toContainText('0');
      
      // Verify data was saved
      await page.reload();
      await expect(page.locator('[data-testid="brake-pads-notes"]')).toHaveValue('Offline note: brakes look good');
    });
  });

  test('should handle validation errors gracefully', async ({ page }) => {
    await authHelper.loginAsMechanic();
    
    // Try to submit incomplete inspection
    await test.step('Attempt to submit incomplete inspection', async () => {
      await inspectionHelper.createBasicInspection();
      
      // Try to submit without any checklist items
      await page.click('[data-testid="submit-approval-btn"]');
      
      // Verify validation errors
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="validation-error"]')).toContainText('At least one item must be inspected');
      
      // Verify submit button is disabled
      await expect(page.locator('[data-testid="submit-approval-btn"]')).toBeDisabled();
    });

    // Fix validation errors
    await test.step('Fix validation errors', async () => {
      // Add minimum required inspection items
      await page.selectOption('[data-testid="brake-pads-status"]', 'good');
      await page.fill('[data-testid="brake-pads-notes"]', 'Brakes checked and in good condition');
      
      // Verify validation passes
      await expect(page.locator('[data-testid="validation-error"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="submit-approval-btn"]')).toBeEnabled();
    });
  });

  test('should support accessibility features', async ({ page }) => {
    await authHelper.loginAsMechanic();
    
    // Test keyboard navigation
    await test.step('Test keyboard navigation', async () => {
      await page.keyboard.press('Tab'); // Navigate to create inspection
      await page.keyboard.press('Enter'); // Activate button
      
      await expect(page.locator('[data-testid="create-inspection-form"]')).toBeVisible();
      
      // Tab through form fields
      await page.keyboard.press('Tab'); // Customer select
      await page.keyboard.press('Tab'); // Vehicle make
      await page.keyboard.press('Tab'); // Vehicle model
      
      // Verify focus indicators
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toHaveAttribute('data-testid', 'vehicle-model');
    });

    // Test screen reader compatibility
    await test.step('Test screen reader compatibility', async () => {
      const inspectionId = await inspectionHelper.createBasicInspection();
      
      // Verify ARIA labels and descriptions
      await expect(page.locator('[data-testid="brake-pads-status"]')).toHaveAttribute('aria-label');
      await expect(page.locator('[data-testid="inspection-progress"]')).toHaveAttribute('aria-valuenow');
      await expect(page.locator('[data-testid="critical-alert"]')).toHaveAttribute('role', 'alert');
    });

    // Test high contrast mode
    await test.step('Test high contrast mode', async () => {
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
      
      // Verify elements are still visible and readable
      await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible();
      
      // Check color contrast meets accessibility standards
      const backgroundColor = await page.locator('body').evaluate(el => 
        getComputedStyle(el).backgroundColor
      );
      const textColor = await page.locator('body').evaluate(el => 
        getComputedStyle(el).color
      );
      
      // Basic contrast check (actual implementation would use a contrast ratio calculator)
      expect(backgroundColor).not.toBe(textColor);
    });
  });

  test('should handle performance under load', async ({ page }) => {
    await authHelper.loginAsMechanic();
    
    // Test with large inspection checklist
    await test.step('Handle large checklist efficiently', async () => {
      const inspectionId = await inspectionHelper.createBasicInspection();
      
      // Start performance measurement
      const startTime = Date.now();
      
      // Fill out comprehensive checklist (50+ items)
      const categories = ['brakes', 'engine', 'transmission', 'electrical', 'tires', 'suspension'];
      for (const category of categories) {
        await page.click(`[data-testid="category-${category}"]`);
        
        // Add multiple items per category
        for (let i = 1; i <= 8; i++) {
          const itemSelector = `[data-testid="${category}-item-${i}-status"]`;
          if (await page.locator(itemSelector).count() > 0) {
            await page.selectOption(itemSelector, 'good');
            await page.fill(`[data-testid="${category}-item-${i}-notes"]`, `Item ${i} checked and okay`);
          }
        }
      }
      
      await page.click('[data-testid="save-progress-btn"]');
      await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Verify performance is acceptable (under 30 seconds for full checklist)
      expect(duration).toBeLessThan(30000);
    });

    // Test photo upload performance
    await test.step('Handle multiple photo uploads', async () => {
      const startTime = Date.now();
      
      // Upload 10 photos
      for (let i = 1; i <= 10; i++) {
        await page.setInputFiles('[data-testid="photo-upload"]', `./test-assets/photo-${i}.jpg`);
        await page.fill('[data-testid="photo-description"]', `Test photo ${i}`);
        await page.click('[data-testid="upload-photo-btn"]');
        
        // Wait for upload to complete
        await expect(page.locator(`[data-testid="photo-${i}"]`)).toBeVisible();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Verify all photos uploaded in reasonable time (under 60 seconds)
      expect(duration).toBeLessThan(60000);
      
      // Verify photo count
      const photoCount = await page.locator('[data-testid="photo-thumbnail"]').count();
      expect(photoCount).toBe(10);
    });
  });
});
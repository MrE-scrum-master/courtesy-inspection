import { Pool } from 'pg';
import { ReportService } from '../src/services/ReportService';
import fs from 'fs/promises';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('handlebars');
jest.mock('puppeteer');

const mockPool = {
  query: jest.fn(),
} as unknown as Pool;

const mockHandlebars = {
  compile: jest.fn(),
  registerHelper: jest.fn(),
  SafeString: jest.fn(),
};

const mockPuppeteer = {
  launch: jest.fn(),
};

// Mock modules
jest.mock('handlebars', () => mockHandlebars);
jest.mock('puppeteer', () => mockPuppeteer);

describe('ReportService', () => {
  let reportService: ReportService;
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup puppeteer mocks
    mockPage = {
      setContent: jest.fn(),
      pdf: jest.fn(),
      close: jest.fn(),
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    };

    mockPuppeteer.launch.mockResolvedValue(mockBrowser);

    // Setup handlebars mocks
    const mockTemplate = jest.fn().mockReturnValue('<html>Mock Report</html>');
    mockHandlebars.compile.mockReturnValue(mockTemplate);

    // Setup fs mocks
    (fs.readFile as jest.Mock).mockResolvedValue('<html>{{shop.name}} Report Template</html>');
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

    reportService = new ReportService(mockPool);
  });

  describe('generateInspectionReport', () => {
    const mockInspectionData = {
      inspection: {
        id: 1,
        reference_number: 'INS-001',
        status: 'completed',
        completed_at: new Date(),
        notes: 'Vehicle inspection completed successfully',
        recommendations: 'Replace brake pads soon',
        urgency_level: 'medium' as const,
        total_estimated_cost: 25000, // $250.00
      },
      customer: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+11234567890',
        address: '123 Main St, Anytown, ST 12345',
      },
      vehicle: {
        year: 2020,
        make: 'Toyota',
        model: 'Camry',
        vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
      },
      shop: {
        name: 'AutoCare Plus',
        address: '456 Service Rd, Anytown, ST 12345',
        phone: '+19876543210',
        email: 'info@autocare.com',
        website: 'https://autocare.com',
        logo_url: 'https://autocare.com/logo.png',
      },
      mechanic: {
        name: 'Mike Johnson',
        certification_level: 'ASE Certified',
      },
      inspection_items: [
        {
          id: 1,
          component: 'Brake Pads',
          status: 'warning' as const,
          notes: 'Worn, should be replaced soon',
          recommendation: 'Replace within 1000 miles',
          estimated_cost: 15000, // $150.00
          priority: 'medium' as const,
          photo_urls: ['https://example.com/brake-photo.jpg'],
        },
        {
          id: 2,
          component: 'Engine Oil',
          status: 'pass' as const,
          notes: 'Oil level and quality good',
          recommendation: 'Next change in 3000 miles',
          estimated_cost: 0,
          priority: 'low' as const,
          photo_urls: [],
        },
      ],
      photos: [
        {
          url: 'https://example.com/overall-photo.jpg',
          caption: 'Overall vehicle condition',
          category: 'general',
        },
      ],
      workflow_history: [
        {
          action: 'Inspection Started',
          user_name: 'Mike Johnson',
          timestamp: new Date('2024-01-15T09:00:00Z'),
          comments: 'Beginning vehicle inspection',
        },
        {
          action: 'Inspection Completed',
          user_name: 'Mike Johnson',
          timestamp: new Date('2024-01-15T10:30:00Z'),
          comments: 'All items inspected',
        },
      ],
    };

    beforeEach(() => {
      // Mock the database query to return inspection data
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ ...mockInspectionData.inspection, ...mockInspectionData.customer, ...mockInspectionData.vehicle, ...mockInspectionData.shop, ...mockInspectionData.mechanic }] })
        .mockResolvedValueOnce({ rows: mockInspectionData.inspection_items })
        .mockResolvedValueOnce({ rows: mockInspectionData.photos })
        .mockResolvedValueOnce({ rows: mockInspectionData.workflow_history });
    });

    it('should generate HTML report successfully', async () => {
      const result = await reportService.generateInspectionReport(1, { format: 'html' });

      expect(result.html).toBe('<html>Mock Report</html>');
      expect(result.filename).toMatch(/inspection-INS-001-\d+\.html/);
      expect(mockPool.query).toHaveBeenCalledTimes(4);
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('inspection-report.hbs'),
        'utf-8'
      );
    });

    it('should generate PDF report successfully', async () => {
      const mockPdfBuffer = Buffer.from('Mock PDF Content');
      mockPage.pdf.mockResolvedValue(mockPdfBuffer);

      const result = await reportService.generateInspectionReport(1, { format: 'pdf' });

      expect(result.pdf).toBe(mockPdfBuffer);
      expect(result.filename).toMatch(/inspection-INS-001-\d+\.pdf/);
      expect(mockPage.setContent).toHaveBeenCalledWith('<html>Mock Report</html>', { waitUntil: 'networkidle0' });
      expect(mockPage.pdf).toHaveBeenCalledWith({
        format: 'A4',
        landscape: false,
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      });
    });

    it('should handle different PDF options', async () => {
      const mockPdfBuffer = Buffer.from('Mock PDF Content');
      mockPage.pdf.mockResolvedValue(mockPdfBuffer);

      await reportService.generateInspectionReport(1, {
        format: 'pdf',
        pageSize: 'Letter',
        orientation: 'landscape',
      });

      expect(mockPage.pdf).toHaveBeenCalledWith({
        format: 'Letter',
        landscape: true,
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      });
    });

    it('should throw error for non-existent inspection', async () => {
      mockPool.query = jest.fn().mockResolvedValueOnce({ rows: [] });

      await expect(reportService.generateInspectionReport(999, { format: 'html' }))
        .rejects.toThrow('Inspection not found: 999');
    });
  });

  describe('generateSummaryReport', () => {
    const mockSummaryData = {
      shop: {
        name: 'AutoCare Plus',
        id: 1,
      },
      period: {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31'),
      },
      summary: {
        total_inspections: 45,
        completed_inspections: 42,
        pending_inspections: 2,
        failed_inspections: 1,
        average_completion_time: 90, // minutes
        total_revenue: 112500, // $1125.00
        top_issues: [
          { component: 'Brake Pads', failure_count: 8, percentage: 18.6 },
          { component: 'Air Filter', failure_count: 5, percentage: 11.6 },
        ],
      },
      inspections: [
        {
          id: 1,
          reference_number: 'INS-001',
          customer_name: 'John Doe',
          vehicle_info: '2020 Toyota Camry',
          status: 'completed',
          completed_at: new Date('2024-01-15'),
          total_cost: 25000,
          urgency_level: 'medium',
        },
      ],
    };

    beforeEach(() => {
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'AutoCare Plus' }] }) // shop info
        .mockResolvedValueOnce({ rows: [{ 
          total_inspections: '45',
          completed_inspections: '42',
          pending_inspections: '2',
          failed_inspections: '1',
          avg_completion_time: '90',
          total_revenue: '112500'
        }] }) // summary stats
        .mockResolvedValueOnce({ rows: mockSummaryData.summary.top_issues }) // top issues
        .mockResolvedValueOnce({ rows: mockSummaryData.inspections }); // inspections list
    });

    it('should generate summary report successfully', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await reportService.generateSummaryReport(1, startDate, endDate, { format: 'html' });

      expect(result.html).toBe('<html>Mock Report</html>');
      expect(result.filename).toMatch(/summary-1-2024-01-01-2024-01-31/);
      expect(mockPool.query).toHaveBeenCalledTimes(4);
    });
  });

  describe('generateCustomerInvoice', () => {
    beforeEach(() => {
      // Mock inspection data for invoice
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ 
          id: 1,
          reference_number: 'INS-001',
          status: 'completed',
          completed_at: new Date(),
          total_estimated_cost: 25000,
          // customer data
          customer_name: 'John Doe',
          customer_email: 'john@example.com',
          customer_phone: '+11234567890',
          customer_address: '123 Main St',
          // vehicle data
          vehicle_year: 2020,
          vehicle_make: 'Toyota',
          vehicle_model: 'Camry',
          vehicle_vin: '1HGBH41JXMN109186',
          vehicle_mileage: 45000,
          // shop data
          shop_name: 'AutoCare Plus',
          shop_address: '456 Service Rd',
          shop_phone: '+19876543210',
          shop_email: 'info@autocare.com',
          // mechanic data
          mechanic_name: 'Mike Johnson',
          certification_level: 'ASE Certified'
        }] ])
        .mockResolvedValueOnce({ rows: [] }) // inspection items
        .mockResolvedValueOnce({ rows: [] }) // photos
        .mockResolvedValueOnce({ rows: [] }); // workflow history
    });

    it('should generate customer invoice successfully', async () => {
      const result = await reportService.generateCustomerInvoice(1, { format: 'html' });

      expect(result.html).toBe('<html>Mock Report</html>');
      expect(result.filename).toMatch(/invoice-INV-INS-001-\d+\.html/);
    });

    it('should calculate tax correctly', async () => {
      const mockPdfBuffer = Buffer.from('Mock PDF Content');
      mockPage.pdf.mockResolvedValue(mockPdfBuffer);

      await reportService.generateCustomerInvoice(1, { format: 'pdf' });

      // Verify template was called with correct data including tax calculations
      const templateCall = mockHandlebars.compile().mock.calls[0][0];
      expect(templateCall.invoice.subtotal).toBe(25000); // $250.00
      expect(templateCall.invoice.tax_amount).toBe(2000); // $20.00 (8% tax)
      expect(templateCall.invoice.total).toBe(27000); // $270.00
    });
  });

  describe('createEmailableReport', () => {
    beforeEach(() => {
      // Mock inspection data
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ 
          id: 1,
          reference_number: 'INS-001',
          // ... other inspection data
        }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
    });

    it('should generate email-optimized HTML report', async () => {
      const html = await reportService.createEmailableReport(1);

      expect(html).toBe('<html>Mock Report</html>');
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('inspection-email.hbs'),
        'utf-8'
      );
    });
  });

  describe('Handlebars helpers', () => {
    beforeEach(() => {
      // Initialize the service to register helpers
      new ReportService(mockPool);
    });

    it('should register all required helpers', () => {
      const expectedHelpers = [
        'formatDate',
        'formatCurrency',
        'statusBadge',
        'urgencyColor',
        'add',
        'multiply',
        'percentage',
        'ifEquals',
        'ifGreaterThan',
      ];

      expectedHelpers.forEach(helper => {
        expect(mockHandlebars.registerHelper).toHaveBeenCalledWith(
          helper,
          expect.any(Function)
        );
      });
    });
  });

  describe('cleanup', () => {
    it('should close browser instance', async () => {
      // Initialize browser
      await reportService.generateInspectionReport(1, { format: 'pdf' });
      
      await reportService.cleanup();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle cleanup when no browser exists', async () => {
      await expect(reportService.cleanup()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle template file not found', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(reportService.generateInspectionReport(1, { format: 'html' }))
        .rejects.toThrow('Template rendering failed: inspection-report');
    });

    it('should handle PDF generation failure', async () => {
      mockPage.pdf.mockRejectedValue(new Error('PDF generation failed'));

      await expect(reportService.generateInspectionReport(1, { format: 'pdf' }))
        .rejects.toThrow('PDF generation failed');
    });

    it('should handle database connection error', async () => {
      mockPool.query = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      await expect(reportService.generateInspectionReport(1, { format: 'html' }))
        .rejects.toThrow('Database connection failed');
    });
  });
});
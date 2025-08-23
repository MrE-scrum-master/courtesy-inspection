import { Pool } from 'pg';
import handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/Logger';

export interface InspectionReportData {
  inspection: {
    id: number;
    reference_number: string;
    status: string;
    completed_at: Date;
    notes: string;
    recommendations: string;
    urgency_level: 'low' | 'medium' | 'high' | 'critical';
    total_estimated_cost: number;
  };
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  vehicle: {
    year: number;
    make: string;
    model: string;
    vin: string;
    mileage: number;
    license_plate: string;
  };
  shop: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    logo_url?: string;
  };
  mechanic: {
    name: string;
    certification_level: string;
  };
  inspection_items: Array<{
    id: number;
    component: string;
    status: 'pass' | 'fail' | 'warning' | 'info';
    notes: string;
    recommendation: string;
    estimated_cost: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
    photo_urls: string[];
  }>;
  photos: Array<{
    url: string;
    caption: string;
    category: string;
  }>;
  workflow_history: Array<{
    action: string;
    user_name: string;
    timestamp: Date;
    comments: string;
  }>;
}

export interface SummaryReportData {
  shop: {
    name: string;
    id: number;
  };
  period: {
    start_date: Date;
    end_date: Date;
  };
  summary: {
    total_inspections: number;
    completed_inspections: number;
    pending_inspections: number;
    failed_inspections: number;
    average_completion_time: number; // minutes
    total_revenue: number;
    top_issues: Array<{
      component: string;
      failure_count: number;
      percentage: number;
    }>;
  };
  inspections: Array<{
    id: number;
    reference_number: string;
    customer_name: string;
    vehicle_info: string;
    status: string;
    completed_at: Date;
    total_cost: number;
    urgency_level: string;
  }>;
}

export interface CustomerInvoiceData {
  invoice: {
    number: string;
    date: Date;
    due_date: Date;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
  };
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  vehicle: {
    year: number;
    make: string;
    model: string;
    vin: string;
    mileage: number;
  };
  shop: {
    name: string;
    address: string;
    phone: string;
    email: string;
    tax_id?: string;
    logo_url?: string;
  };
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    category: 'inspection' | 'repair' | 'parts' | 'labor';
  }>;
  inspection: {
    id: number;
    reference_number: string;
    completed_at: Date;
    mechanic_name: string;
  };
}

export interface ReportGenerationOptions {
  format: 'html' | 'pdf';
  theme?: 'default' | 'professional' | 'modern';
  includePhotos?: boolean;
  includeQRCode?: boolean;
  watermark?: string;
  pageSize?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
}

export class ReportService {
  private readonly pool: Pool;
  private readonly logger: Logger;
  private readonly templatesPath: string;
  private readonly outputPath: string;
  private browser: puppeteer.Browser | null = null;

  constructor(pool: Pool) {
    this.pool = pool;
    this.logger = new Logger('ReportService');
    this.templatesPath = path.join(__dirname, '../templates');
    this.outputPath = process.env.REPORTS_OUTPUT_PATH || path.join(process.cwd(), 'tmp/reports');
    
    this.initializeHandlebarsHelpers();
    this.ensureOutputDirectory();
  }

  /**
   * Generate inspection report (HTML/PDF)
   */
  async generateInspectionReport(
    inspectionId: number,
    options: ReportGenerationOptions = { format: 'pdf' }
  ): Promise<{ html?: string; pdf?: Buffer; filename: string }> {
    const reportData = await this.getInspectionReportData(inspectionId);
    
    if (!reportData) {
      throw new Error(`Inspection not found: ${inspectionId}`);
    }

    const html = await this.renderTemplate('inspection-report', reportData, options);
    const filename = `inspection-${reportData.inspection.reference_number}-${Date.now()}`;

    if (options.format === 'html') {
      return { html, filename: `${filename}.html` };
    }

    const pdf = await this.generatePDF(html, options);
    return { pdf, filename: `${filename}.pdf` };
  }

  /**
   * Generate summary report for a shop
   */
  async generateSummaryReport(
    shopId: number,
    startDate: Date,
    endDate: Date,
    options: ReportGenerationOptions = { format: 'pdf' }
  ): Promise<{ html?: string; pdf?: Buffer; filename: string }> {
    const reportData = await this.getSummaryReportData(shopId, startDate, endDate);
    
    const html = await this.renderTemplate('summary-report', reportData, options);
    const filename = `summary-${shopId}-${this.formatDateForFilename(startDate)}-${this.formatDateForFilename(endDate)}`;

    if (options.format === 'html') {
      return { html, filename: `${filename}.html` };
    }

    const pdf = await this.generatePDF(html, options);
    return { pdf, filename: `${filename}.pdf` };
  }

  /**
   * Generate customer invoice
   */
  async generateCustomerInvoice(
    inspectionId: number,
    options: ReportGenerationOptions = { format: 'pdf' }
  ): Promise<{ html?: string; pdf?: Buffer; filename: string }> {
    const invoiceData = await this.getCustomerInvoiceData(inspectionId);
    
    if (!invoiceData) {
      throw new Error(`Invoice data not found for inspection: ${inspectionId}`);
    }

    const html = await this.renderTemplate('customer-invoice', invoiceData, options);
    const filename = `invoice-${invoiceData.invoice.number}-${Date.now()}`;

    if (options.format === 'html') {
      return { html, filename: `${filename}.html` };
    }

    const pdf = await this.generatePDF(html, options);
    return { pdf, filename: `${filename}.pdf` };
  }

  /**
   * Create emailable report (optimized HTML for email)
   */
  async createEmailableReport(inspectionId: number): Promise<string> {
    const reportData = await this.getInspectionReportData(inspectionId);
    
    if (!reportData) {
      throw new Error(`Inspection not found: ${inspectionId}`);
    }

    // Use email-optimized template
    return this.renderTemplate('inspection-email', reportData, {
      format: 'html',
      includePhotos: false, // Photos as attachments instead
      theme: 'default',
    });
  }

  // Private helper methods

  private async getInspectionReportData(inspectionId: number): Promise<InspectionReportData | null> {
    const query = `
      SELECT 
        i.id, i.reference_number, i.status, i.completed_at, i.notes, 
        i.recommendations, i.urgency_level, i.total_estimated_cost,
        c.name as customer_name, c.email as customer_email, 
        c.phone as customer_phone, c.address as customer_address,
        i.vehicle_year, i.vehicle_make, i.vehicle_model, i.vehicle_vin,
        i.vehicle_mileage, i.vehicle_license_plate,
        s.name as shop_name, s.address as shop_address, 
        s.phone as shop_phone, s.email as shop_email,
        s.website as shop_website, s.logo_url as shop_logo_url,
        u.full_name as mechanic_name, u.certification_level
      FROM inspections i
      JOIN customers c ON i.customer_id = c.id
      JOIN shops s ON i.shop_id = s.id
      JOIN users u ON i.mechanic_id = u.id
      WHERE i.id = $1
    `;

    const result = await this.pool.query(query, [inspectionId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Get inspection items
    const itemsQuery = `
      SELECT 
        id, component, status, notes, recommendation, 
        estimated_cost, priority, photo_urls
      FROM inspection_items 
      WHERE inspection_id = $1 
      ORDER BY priority DESC, component
    `;
    const itemsResult = await this.pool.query(itemsQuery, [inspectionId]);

    // Get photos
    const photosQuery = `
      SELECT url, caption, category 
      FROM inspection_photos 
      WHERE inspection_id = $1 
      ORDER BY created_at
    `;
    const photosResult = await this.pool.query(photosQuery, [inspectionId]);

    // Get workflow history
    const historyQuery = `
      SELECT 
        wh.action, u.full_name as user_name, 
        wh.timestamp, wh.comments
      FROM workflow_history wh
      JOIN users u ON wh.user_id = u.id
      WHERE wh.inspection_id = $1 
      ORDER BY wh.timestamp
    `;
    const historyResult = await this.pool.query(historyQuery, [inspectionId]);

    return {
      inspection: {
        id: row.id,
        reference_number: row.reference_number,
        status: row.status,
        completed_at: row.completed_at,
        notes: row.notes || '',
        recommendations: row.recommendations || '',
        urgency_level: row.urgency_level,
        total_estimated_cost: row.total_estimated_cost || 0,
      },
      customer: {
        name: row.customer_name,
        email: row.customer_email,
        phone: row.customer_phone,
        address: row.customer_address || '',
      },
      vehicle: {
        year: row.vehicle_year,
        make: row.vehicle_make,
        model: row.vehicle_model,
        vin: row.vehicle_vin,
        mileage: row.vehicle_mileage,
        license_plate: row.vehicle_license_plate || '',
      },
      shop: {
        name: row.shop_name,
        address: row.shop_address,
        phone: row.shop_phone,
        email: row.shop_email,
        website: row.shop_website,
        logo_url: row.shop_logo_url,
      },
      mechanic: {
        name: row.mechanic_name,
        certification_level: row.certification_level || 'Certified',
      },
      inspection_items: itemsResult.rows,
      photos: photosResult.rows,
      workflow_history: historyResult.rows,
    };
  }

  private async getSummaryReportData(
    shopId: number,
    startDate: Date,
    endDate: Date
  ): Promise<SummaryReportData> {
    // Get shop info
    const shopQuery = 'SELECT id, name FROM shops WHERE id = $1';
    const shopResult = await this.pool.query(shopQuery, [shopId]);
    const shop = shopResult.rows[0];

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_inspections,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_inspections,
        COUNT(*) FILTER (WHERE status = 'in_progress') as pending_inspections,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_inspections,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_completion_time,
        SUM(total_estimated_cost) as total_revenue
      FROM inspections 
      WHERE shop_id = $1 
      AND created_at BETWEEN $2 AND $3
    `;
    const summaryResult = await this.pool.query(summaryQuery, [shopId, startDate, endDate]);
    const summary = summaryResult.rows[0];

    // Get top issues
    const issuesQuery = `
      SELECT 
        component,
        COUNT(*) as failure_count,
        ROUND(COUNT(*)::decimal / (SELECT COUNT(*) FROM inspection_items ii2 
                                  JOIN inspections i2 ON ii2.inspection_id = i2.id 
                                  WHERE i2.shop_id = $1 AND i2.created_at BETWEEN $2 AND $3) * 100, 1) as percentage
      FROM inspection_items ii
      JOIN inspections i ON ii.inspection_id = i.id
      WHERE i.shop_id = $1 
      AND i.created_at BETWEEN $2 AND $3
      AND ii.status IN ('fail', 'warning')
      GROUP BY component
      ORDER BY failure_count DESC
      LIMIT 10
    `;
    const issuesResult = await this.pool.query(issuesQuery, [shopId, startDate, endDate]);

    // Get inspection list
    const inspectionsQuery = `
      SELECT 
        i.id, i.reference_number, c.name as customer_name,
        CONCAT(i.vehicle_year, ' ', i.vehicle_make, ' ', i.vehicle_model) as vehicle_info,
        i.status, i.completed_at, i.total_estimated_cost, i.urgency_level
      FROM inspections i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.shop_id = $1 
      AND i.created_at BETWEEN $2 AND $3
      ORDER BY i.created_at DESC
    `;
    const inspectionsResult = await this.pool.query(inspectionsQuery, [shopId, startDate, endDate]);

    return {
      shop: {
        name: shop.name,
        id: shop.id,
      },
      period: {
        start_date: startDate,
        end_date: endDate,
      },
      summary: {
        total_inspections: parseInt(summary.total_inspections),
        completed_inspections: parseInt(summary.completed_inspections),
        pending_inspections: parseInt(summary.pending_inspections),
        failed_inspections: parseInt(summary.failed_inspections),
        average_completion_time: Math.round(parseFloat(summary.avg_completion_time) || 0),
        total_revenue: parseFloat(summary.total_revenue) || 0,
        top_issues: issuesResult.rows,
      },
      inspections: inspectionsResult.rows.map(row => ({
        ...row,
        total_cost: parseFloat(row.total_estimated_cost) || 0,
      })),
    };
  }

  private async getCustomerInvoiceData(inspectionId: number): Promise<CustomerInvoiceData | null> {
    // This would be implemented based on your invoicing requirements
    // For now, returning a basic structure
    const inspectionData = await this.getInspectionReportData(inspectionId);
    
    if (!inspectionData) {
      return null;
    }

    const subtotal = inspectionData.inspection.total_estimated_cost;
    const taxRate = 0.08; // 8% tax rate - should be configurable
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    return {
      invoice: {
        number: `INV-${inspectionData.inspection.reference_number}`,
        date: new Date(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
      },
      customer: inspectionData.customer,
      vehicle: inspectionData.vehicle,
      shop: inspectionData.shop,
      line_items: [
        {
          description: `Vehicle Inspection - ${inspectionData.vehicle.year} ${inspectionData.vehicle.make} ${inspectionData.vehicle.model}`,
          quantity: 1,
          unit_price: subtotal,
          total: subtotal,
          category: 'inspection',
        },
      ],
      inspection: {
        id: inspectionData.inspection.id,
        reference_number: inspectionData.inspection.reference_number,
        completed_at: inspectionData.inspection.completed_at,
        mechanic_name: inspectionData.mechanic.name,
      },
    };
  }

  private async renderTemplate(
    templateName: string,
    data: any,
    options: ReportGenerationOptions
  ): Promise<string> {
    const templatePath = path.join(this.templatesPath, `${templateName}.hbs`);
    
    try {
      const templateSource = await fs.readFile(templatePath, 'utf-8');
      const template = handlebars.compile(templateSource);
      
      // Add options and helpers to template data
      const templateData = {
        ...data,
        options,
        generateTime: new Date(),
        theme: options.theme || 'default',
      };

      return template(templateData);
    } catch (error) {
      this.logger.error(`Failed to render template ${templateName}:`, error);
      throw new Error(`Template rendering failed: ${templateName}`);
    }
  }

  private async generatePDF(html: string, options: ReportGenerationOptions): Promise<Buffer> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await this.browser.newPage();
    
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfOptions: puppeteer.PDFOptions = {
        format: options.pageSize || 'A4',
        landscape: options.orientation === 'landscape',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      };

      const pdfBuffer = await page.pdf(pdfOptions);
      return pdfBuffer;
    } finally {
      await page.close();
    }
  }

  private initializeHandlebarsHelpers(): void {
    // Date formatting helper
    handlebars.registerHelper('formatDate', (date: Date, format: string) => {
      if (!date) return '';
      
      switch (format) {
        case 'short':
          return date.toLocaleDateString();
        case 'long':
          return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        case 'time':
          return date.toLocaleTimeString();
        default:
          return date.toLocaleString();
      }
    });

    // Currency formatting helper
    handlebars.registerHelper('formatCurrency', (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount || 0);
    });

    // Status badge helper
    handlebars.registerHelper('statusBadge', (status: string) => {
      const statusClasses = {
        pass: 'badge-success',
        fail: 'badge-danger',
        warning: 'badge-warning',
        info: 'badge-info',
        completed: 'badge-success',
        pending: 'badge-warning',
        failed: 'badge-danger',
      };
      
      const className = statusClasses[status as keyof typeof statusClasses] || 'badge-secondary';
      return new handlebars.SafeString(`<span class="badge ${className}">${status.toUpperCase()}</span>`);
    });

    // Urgency color helper
    handlebars.registerHelper('urgencyColor', (urgency: string) => {
      const colors = {
        low: '#28a745',
        medium: '#ffc107',
        high: '#fd7e14',
        critical: '#dc3545',
      };
      
      return colors[urgency as keyof typeof colors] || '#6c757d';
    });

    // Math helpers
    handlebars.registerHelper('add', (a: number, b: number) => a + b);
    handlebars.registerHelper('multiply', (a: number, b: number) => a * b);
    handlebars.registerHelper('percentage', (value: number, total: number) => {
      return total > 0 ? Math.round((value / total) * 100) : 0;
    });

    // Conditional helpers
    handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    handlebars.registerHelper('ifGreaterThan', function(arg1, arg2, options) {
      return (arg1 > arg2) ? options.fn(this) : options.inverse(this);
    });
  }

  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.access(this.outputPath);
    } catch {
      await fs.mkdir(this.outputPath, { recursive: true });
    }
  }

  private formatDateForFilename(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Cleanup method to close browser instance
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
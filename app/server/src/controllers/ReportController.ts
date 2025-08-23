import { Request, Response } from 'express';
import { Pool } from 'pg';
import { ReportService, ReportGenerationOptions } from '../services/ReportService';
import { Logger } from '../utils/Logger';

export class ReportController {
  private readonly reportService: ReportService;
  private readonly logger: Logger;

  constructor(pool: Pool) {
    this.reportService = new ReportService(pool);
    this.logger = new Logger('ReportController');
  }

  /**
   * Generate inspection report
   */
  generateInspectionReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const inspectionId = parseInt(req.params.inspectionId);
      
      if (isNaN(inspectionId)) {
        res.status(400).json({
          error: 'Invalid inspection ID',
        });
        return;
      }

      const options: ReportGenerationOptions = {
        format: (req.query.format as 'html' | 'pdf') || 'pdf',
        theme: (req.query.theme as 'default' | 'professional' | 'modern') || 'default',
        includePhotos: req.query.include_photos !== 'false',
        includeQRCode: req.query.include_qr === 'true',
        watermark: req.query.watermark as string,
        pageSize: (req.query.page_size as 'A4' | 'Letter') || 'A4',
        orientation: (req.query.orientation as 'portrait' | 'landscape') || 'portrait',
      };

      const result = await this.reportService.generateInspectionReport(inspectionId, options);

      this.logger.info('Inspection report generated', {
        inspectionId,
        format: options.format,
        filename: result.filename,
      });

      if (options.format === 'html') {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
        res.send(result.html);
      } else {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.pdf);
      }

    } catch (error) {
      this.logger.error('Failed to generate inspection report:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Inspection not found',
          details: error.message,
        });
      } else {
        res.status(500).json({
          error: 'Failed to generate inspection report',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  };

  /**
   * Generate summary report for a shop
   */
  generateSummaryReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const shopId = parseInt(req.params.shopId);
      const { start_date, end_date } = req.query;

      if (isNaN(shopId)) {
        res.status(400).json({
          error: 'Invalid shop ID',
        });
        return;
      }

      if (!start_date || !end_date) {
        res.status(400).json({
          error: 'start_date and end_date are required',
        });
        return;
      }

      const startDate = new Date(start_date as string);
      const endDate = new Date(end_date as string);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({
          error: 'Invalid date format',
        });
        return;
      }

      const options: ReportGenerationOptions = {
        format: (req.query.format as 'html' | 'pdf') || 'pdf',
        theme: (req.query.theme as 'default' | 'professional' | 'modern') || 'professional',
        pageSize: (req.query.page_size as 'A4' | 'Letter') || 'A4',
        orientation: (req.query.orientation as 'portrait' | 'landscape') || 'landscape',
      };

      const result = await this.reportService.generateSummaryReport(shopId, startDate, endDate, options);

      this.logger.info('Summary report generated', {
        shopId,
        startDate,
        endDate,
        format: options.format,
        filename: result.filename,
      });

      if (options.format === 'html') {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
        res.send(result.html);
      } else {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.pdf);
      }

    } catch (error) {
      this.logger.error('Failed to generate summary report:', error);
      
      res.status(500).json({
        error: 'Failed to generate summary report',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Generate customer invoice
   */
  generateCustomerInvoice = async (req: Request, res: Response): Promise<void> => {
    try {
      const inspectionId = parseInt(req.params.inspectionId);
      
      if (isNaN(inspectionId)) {
        res.status(400).json({
          error: 'Invalid inspection ID',
        });
        return;
      }

      const options: ReportGenerationOptions = {
        format: (req.query.format as 'html' | 'pdf') || 'pdf',
        theme: (req.query.theme as 'default' | 'professional' | 'modern') || 'professional',
        pageSize: (req.query.page_size as 'A4' | 'Letter') || 'A4',
        orientation: (req.query.orientation as 'portrait' | 'landscape') || 'portrait',
      };

      const result = await this.reportService.generateCustomerInvoice(inspectionId, options);

      this.logger.info('Customer invoice generated', {
        inspectionId,
        format: options.format,
        filename: result.filename,
      });

      if (options.format === 'html') {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
        res.send(result.html);
      } else {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.pdf);
      }

    } catch (error) {
      this.logger.error('Failed to generate customer invoice:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Invoice data not found',
          details: error.message,
        });
      } else {
        res.status(500).json({
          error: 'Failed to generate customer invoice',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  };

  /**
   * Generate emailable report (HTML optimized for email)
   */
  generateEmailableReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const inspectionId = parseInt(req.params.inspectionId);
      
      if (isNaN(inspectionId)) {
        res.status(400).json({
          error: 'Invalid inspection ID',
        });
        return;
      }

      const html = await this.reportService.createEmailableReport(inspectionId);

      this.logger.info('Emailable report generated', {
        inspectionId,
      });

      res.json({
        success: true,
        inspection_id: inspectionId,
        html_content: html,
        generated_at: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error('Failed to generate emailable report:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Inspection not found',
          details: error.message,
        });
      } else {
        res.status(500).json({
          error: 'Failed to generate emailable report',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  };

  /**
   * Get available report templates
   */
  getReportTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
      const templates = [
        {
          name: 'inspection-report',
          description: 'Comprehensive vehicle inspection report',
          formats: ['html', 'pdf'],
          themes: ['default', 'professional', 'modern'],
          options: {
            include_photos: 'Include inspection photos',
            include_qr: 'Include QR code for digital access',
            watermark: 'Custom watermark text',
          },
        },
        {
          name: 'customer-invoice',
          description: 'Customer invoice for inspection services',
          formats: ['html', 'pdf'],
          themes: ['default', 'professional'],
          options: {
            include_payment_terms: 'Include payment terms and conditions',
          },
        },
        {
          name: 'summary-report',
          description: 'Shop performance summary report',
          formats: ['html', 'pdf'],
          themes: ['professional', 'modern'],
          options: {
            include_charts: 'Include performance charts',
            include_trends: 'Include trend analysis',
          },
        },
        {
          name: 'inspection-email',
          description: 'Email-optimized inspection report',
          formats: ['html'],
          themes: ['default'],
          options: {
            compact_layout: 'Use compact layout for email',
          },
        },
      ];

      res.json({
        success: true,
        templates,
      });

    } catch (error) {
      this.logger.error('Failed to get report templates:', error);
      
      res.status(500).json({
        error: 'Failed to get report templates',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Health check for report service
   */
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        service: 'report',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        templates_available: true,
        pdf_generation_available: true,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Health check failed',
      });
    }
  };

  /**
   * Cleanup method to close browser instance
   */
  cleanup = async (): Promise<void> => {
    try {
      await this.reportService.cleanup();
      this.logger.info('Report service cleanup completed');
    } catch (error) {
      this.logger.error('Report service cleanup failed:', error);
    }
  };
}
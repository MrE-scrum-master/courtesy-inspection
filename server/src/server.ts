// Main server application - Express.js with TypeScript architecture
// Production-ready server with middleware, routing, and error handling

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import utilities and services
import { DatabaseUtils } from './utils/database';
import { Logger } from './utils/logger';

// Import middleware
import { AuthMiddleware } from './middleware/auth';
import { ValidationMiddleware } from './middleware/validation';
import { ErrorMiddleware } from './middleware/error';

// Import services
import { AuthService } from './services/AuthService';
import { InspectionService } from './services/InspectionService';
import { VoiceService } from './services/VoiceService';
import { SMSService } from './services/SMSService';

// Import controllers
import { AuthController } from './controllers/AuthController';
import { InspectionController } from './controllers/InspectionController';

// Import validation schemas
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  createInspectionSchema,
  updateInspectionSchema,
  inspectionItemUpdateSchema,
  inspectionQuerySchema,
  voiceInputSchema,
  sendSMSSchema,
  idParamSchema
} from './validators/schemas';

// Import types
import { HttpStatus } from './types/common';

class Server {
  private app: Application;
  private port: number;
  private db: any;

  // Services
  private authService: AuthService;
  private inspectionService: InspectionService;
  private voiceService: VoiceService;
  private smsService: SMSService;

  // Middleware
  private authMiddleware: AuthMiddleware;

  // Controllers
  private authController: AuthController;
  private inspectionController: InspectionController;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000');
    
    this.initializeDatabase();
    this.initializeServices();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeDatabase(): void {
    this.db = DatabaseUtils.getInstance();
  }

  private initializeServices(): void {
    this.authService = new AuthService(this.db);
    this.inspectionService = new InspectionService(this.db);
    this.voiceService = new VoiceService();
    this.smsService = new SMSService();

    // Initialize middleware
    this.authMiddleware = new AuthMiddleware(this.authService);

    // Initialize controllers
    this.authController = new AuthController(this.authService);
    this.inspectionController = new InspectionController(this.inspectionService);
  }

  private initializeMiddleware(): void {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:19006'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID']
    }));

    // Compression
    this.app.use(compression());

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Security and monitoring middleware
    this.app.use(ErrorMiddleware.securityHeaders());
    this.app.use(ErrorMiddleware.logging());
    this.app.use(ErrorMiddleware.performanceMonitoring());
    this.app.use(ValidationMiddleware.sanitizeInput());

    // Request timeout
    this.app.use(ErrorMiddleware.timeout(30000));

    // Correlation ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.correlationId = req.headers['x-correlation-id'] as string || 
                         `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Correlation-ID', req.correlationId);
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check route
    this.app.get('/health', ErrorMiddleware.asyncHandler(async (req: Request, res: Response) => {
      const health = await DatabaseUtils.healthCheck();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: health,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      });
    }));

    // API info route
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Courtesy Inspection API',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        documentation: '/api/docs'
      });
    });

    // Authentication routes
    this.app.post('/auth/register',
      ValidationMiddleware.validateBody(registerSchema),
      ErrorMiddleware.asyncHandler(this.authController.register)
    );

    this.app.post('/auth/login',
      ValidationMiddleware.validateBody(loginSchema),
      ErrorMiddleware.asyncHandler(this.authController.login)
    );

    this.app.post('/auth/refresh',
      ValidationMiddleware.validateBody(refreshTokenSchema),
      ErrorMiddleware.asyncHandler(this.authController.refreshToken)
    );

    this.app.post('/auth/logout',
      ErrorMiddleware.asyncHandler(this.authController.logout)
    );

    this.app.get('/auth/me',
      this.authMiddleware.authenticate(),
      ErrorMiddleware.asyncHandler(this.authController.getProfile)
    );

    this.app.post('/auth/change-password',
      this.authMiddleware.authenticate(),
      ErrorMiddleware.asyncHandler(this.authController.changePassword)
    );

    this.app.post('/auth/revoke-sessions',
      this.authMiddleware.authenticate(),
      ErrorMiddleware.asyncHandler(this.authController.revokeSessions)
    );

    this.app.get('/auth/validate',
      ErrorMiddleware.asyncHandler(this.authController.validateToken)
    );

    // Inspection routes
    this.app.post('/inspections',
      this.authMiddleware.authenticate(),
      ValidationMiddleware.validateBody(createInspectionSchema),
      ErrorMiddleware.asyncHandler(this.inspectionController.createInspection)
    );

    this.app.get('/inspections/:id',
      this.authMiddleware.authenticate(),
      ValidationMiddleware.validateParams(idParamSchema),
      ErrorMiddleware.asyncHandler(this.inspectionController.getInspectionById)
    );

    this.app.get('/inspections',
      this.authMiddleware.authenticate(),
      ValidationMiddleware.validateQuery(inspectionQuerySchema),
      ErrorMiddleware.asyncHandler(this.inspectionController.getInspections)
    );

    this.app.get('/inspections/my',
      this.authMiddleware.authenticate(),
      ValidationMiddleware.validateQuery(inspectionQuerySchema),
      ErrorMiddleware.asyncHandler(this.inspectionController.getMyInspections)
    );

    this.app.put('/inspections/:id',
      this.authMiddleware.authenticate(),
      ValidationMiddleware.validateParams(idParamSchema),
      ValidationMiddleware.validateBody(updateInspectionSchema),
      ErrorMiddleware.asyncHandler(this.inspectionController.updateInspection)
    );

    this.app.patch('/inspections/:id/items',
      this.authMiddleware.authenticate(),
      ValidationMiddleware.validateParams(idParamSchema),
      ValidationMiddleware.validateBody(inspectionItemUpdateSchema),
      ErrorMiddleware.asyncHandler(this.inspectionController.updateInspectionItem)
    );

    this.app.delete('/inspections/:id',
      this.authMiddleware.authenticate(),
      this.authMiddleware.authorize('admin'),
      ValidationMiddleware.validateParams(idParamSchema),
      ErrorMiddleware.asyncHandler(this.inspectionController.deleteInspection)
    );

    this.app.get('/inspections/generate-number/:shopId',
      this.authMiddleware.authenticate(),
      this.authMiddleware.requireShopAccess(),
      ErrorMiddleware.asyncHandler(this.inspectionController.generateInspectionNumber)
    );

    this.app.get('/inspections/statistics/:shopId',
      this.authMiddleware.authenticate(),
      this.authMiddleware.requireShopAccess(),
      ErrorMiddleware.asyncHandler(this.inspectionController.getShopStatistics)
    );

    this.app.get('/inspections/recent/:shopId',
      this.authMiddleware.authenticate(),
      this.authMiddleware.requireShopAccess(),
      ErrorMiddleware.asyncHandler(this.inspectionController.getRecentInspections)
    );

    // Voice processing routes
    this.app.post('/voice/parse',
      this.authMiddleware.authenticate(),
      ValidationMiddleware.validateBody(voiceInputSchema),
      ErrorMiddleware.asyncHandler(async (req: Request, res: Response) => {
        const result = await this.voiceService.parseVoiceInput(req.body);
        
        if (result.success) {
          res.json({
            success: true,
            data: result.data
          });
        } else {
          res.status(result.statusCode || HttpStatus.BAD_REQUEST).json({
            success: false,
            error: result.error
          });
        }
      })
    );

    this.app.get('/voice/components',
      this.authMiddleware.authenticate(),
      ErrorMiddleware.asyncHandler(async (req: Request, res: Response) => {
        const result = await this.voiceService.getAvailableComponents();
        
        if (result.success) {
          res.json({
            success: true,
            data: result.data
          });
        } else {
          res.status(result.statusCode || HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: result.error
          });
        }
      })
    );

    // SMS routes
    this.app.post('/sms/send',
      this.authMiddleware.authenticate(),
      ValidationMiddleware.validateBody(sendSMSSchema),
      ErrorMiddleware.asyncHandler(async (req: Request, res: Response) => {
        const result = await this.smsService.sendSMS(req.body);
        
        if (result.success) {
          res.json({
            success: true,
            data: result.data,
            message: 'SMS sent successfully'
          });
        } else {
          res.status(result.statusCode || HttpStatus.BAD_REQUEST).json({
            success: false,
            error: result.error
          });
        }
      })
    );

    this.app.get('/sms/templates',
      this.authMiddleware.authenticate(),
      ErrorMiddleware.asyncHandler(async (req: Request, res: Response) => {
        const result = await this.smsService.getAvailableTemplates();
        
        if (result.success) {
          res.json({
            success: true,
            data: result.data
          });
        } else {
          res.status(result.statusCode || HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: result.error
          });
        }
      })
    );

    this.app.post('/sms/webhook',
      ErrorMiddleware.asyncHandler(async (req: Request, res: Response) => {
        const result = await this.smsService.handleWebhook(req.body);
        
        if (result.success) {
          res.json({
            success: true,
            data: result.data
          });
        } else {
          res.status(result.statusCode || HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: result.error
          });
        }
      })
    );

    // Database maintenance route (admin only)
    this.app.post('/admin/maintenance',
      this.authMiddleware.authenticate(),
      this.authMiddleware.authorize('admin'),
      ErrorMiddleware.asyncHandler(async (req: Request, res: Response) => {
        const result = await DatabaseUtils.runMaintenance();
        res.json({
          success: true,
          data: result
        });
      })
    );
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(ErrorMiddleware.notFound());

    // Global error handler
    this.app.use(ErrorMiddleware.handle());
  }

  public async start(): Promise<void> {
    try {
      // Test database connection
      const health = await DatabaseUtils.healthCheck();
      if (health.status !== 'healthy') {
        throw new Error('Database connection failed');
      }

      // Start server
      this.app.listen(this.port, () => {
        Logger.startup(
          process.env.npm_package_version || '1.0.0',
          process.env.NODE_ENV || 'development'
        );
        
        Logger.info(`Server started on port ${this.port}`, {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          database: health.status
        });

        console.log(`🚀 Courtesy Inspection API server started on port ${this.port}`);
        console.log(`📊 Health check: http://localhost:${this.port}/health`);
        console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      });

    } catch (error) {
      Logger.error('Server startup failed', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      Logger.shutdown('Graceful shutdown initiated');
      await DatabaseUtils.close();
      process.exit(0);
    } catch (error) {
      Logger.error('Server shutdown error', error);
      process.exit(1);
    }
  }
}

// Initialize and start server
const server = new Server();

// Graceful shutdown handlers
process.on('SIGTERM', () => server.stop());
process.on('SIGINT', () => server.stop());
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught Exception', error);
  server.stop();
});
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled Rejection', new Error(String(reason)), {
    metadata: { promise }
  });
});

// Start the server
server.start().catch((error) => {
  Logger.error('Failed to start server', error);
  process.exit(1);
});

export default server;
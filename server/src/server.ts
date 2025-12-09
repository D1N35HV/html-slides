import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import config from './config/database';
import Database from './config/mongodb';
import presentationRoutes from './routes/presentationRoutes';
import authRoutes from './routes/authRoutes';
import uploadRoutes from './routes/uploadRoutes';
import templateRoutes from './routes/templateRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware';
import CollaborationServer from './realtime/CollaborationServer';

class Server {
  private app: express.Application;
  private database: Database;

  constructor() {
    this.app = express();
    this.database = Database.getInstance();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable CSP for development
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' } // Allow cross-origin resource loading
    }));

    // Trust first proxy (useful if deployed behind reverse proxy / docker / vercel etc.)
    this.app.set('trust proxy', 1);

    // CORS configuration
    this.app.use(cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Compression middleware
    this.app.use(compression());

    // Logging middleware
    if (config.nodeEnv !== 'test') {
      this.app.use(morgan('combined'));
    }

    // Rate limiting (skip in development unless explicitly enabled)
    if (!config.rateLimitDisabled) {
      const limiter = rateLimit({
        windowMs: config.rateLimitWindowMs,
        max: config.rateLimitMaxRequests,
        message: {
          success: false,
          message: 'Too many requests from this IP, please try again later'
        },
        standardHeaders: true,
        legacyHeaders: false
      });
      this.app.use('/api/', limiter);
    }

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static files
    this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        database: this.database.getConnectionStatus() ? 'connected' : 'disconnected'
      });
    });
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/presentations', presentationRoutes);
    this.app.use('/api/uploads', uploadRoutes);
    this.app.use('/api/templates', templateRoutes);

    // API documentation endpoint
    this.app.get('/api', (_req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        message: 'Slides API v1.0.0',
        endpoints: {
          auth: '/api/auth',
          presentations: '/api/presentations',
          health: '/health'
        },
        documentation: 'https://api-docs.slides.com'
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await this.database.connect();

      // Start server
      const server = this.app.listen(config.port, () => {
        console.log(`🚀 Server running on port ${config.port}`);
        console.log(`📊 Environment: ${config.nodeEnv}`);
        console.log(`🔗 Health check: http://localhost:${config.port}/health`);
        console.log(`📚 API: http://localhost:${config.port}/api`);
      });

      // Initialize collaboration layer (websockets)
      const collaborationServer = new CollaborationServer(server, config.corsOrigins);
      this.app.set('collaborationServer', collaborationServer);
      console.log('🧩 Real-time collaboration enabled.');

      // Graceful shutdown
      const gracefulShutdown = async (signal: string) => {
        console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

        server.close(async () => {
          console.log('📪 HTTP server closed.');

          try {
            await this.database.disconnect();
            console.log('🔌 Database connection closed.');
            process.exit(0);
          } catch (error) {
            console.error('❌ Error during database disconnection:', error);
            process.exit(1);
          }
        });

        // Force close server after 30 seconds
        setTimeout(() => {
          console.error('⏰ Could not close connections in time, forcefully shutting down');
          process.exit(1);
        }, 30000);
      };

      // Listen for termination signals
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

      // Handle uncaught exceptions
      process.on('uncaughtException', (error: Error) => {
        console.error('💥 Uncaught Exception:', error);
        gracefulShutdown('UNCAUGHT_EXCEPTION');
      });

      // Handle unhandled promise rejections
      process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
        console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
        gracefulShutdown('UNHANDLED_REJECTION');
      });

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new Server();
  server.start();
}

export default Server;

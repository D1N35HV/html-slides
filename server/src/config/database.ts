import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  port: number;
  mongoUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  rateLimitDisabled: boolean;
  maxFileSize: string;
  uploadPath: string;
  logLevel: string;
  bcryptRounds: number;
  nodeEnv: string;
}

const config: Config = {
  port: parseInt(process.env['PORT'] || '3001'),
  mongoUri: process.env['MONGODB_URI'] || 'mongodb://localhost:27017/slidesdb',
  jwtSecret: process.env['JWT_SECRET'] || 'your-super-secret-jwt-key',
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'] || '7d',
  corsOrigins: process.env['CORS_ORIGINS']?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174'
  ],
  rateLimitWindowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'),
  rateLimitMaxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'),
  rateLimitDisabled: process.env['RATE_LIMIT_DISABLED'] === '1' || (process.env['NODE_ENV'] || 'development') === 'development',
  maxFileSize: process.env['MAX_FILE_SIZE'] || '50MB',
  uploadPath: process.env['UPLOAD_PATH'] || 'uploads/',
  logLevel: process.env['LOG_LEVEL'] || 'info',
  bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] || '12'),
  nodeEnv: process.env['NODE_ENV'] || 'development'
};

export default config;

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env['PORT'] || 3001;

// Middleware
app.use(cors({
  origin: process.env['CORS_ORIGINS']?.split(',') || ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Simple test routes
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] || 'development'
  });
});

app.get('/api', (_req, res) => {
  res.json({ 
    message: 'Slides API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      presentations: '/api/presentations',
      auth: '/api/auth'
    }
  });
});

// Simple presentation endpoint for testing
app.post('/api/presentations', (req, res) => {
  try {
    console.log('Received presentation data:', JSON.stringify(req.body, null, 2));
    
    // For now, just return success with the data
    res.status(201).json({
      success: true,
      message: 'Presentation saved successfully',
      data: {
        _id: 'temp-id-' + Date.now(),
        ...req.body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error saving presentation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save presentation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);
    
    // For testing purposes, accept any email/password combination
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Mock successful login
    const mockUser = {
      _id: 'user-' + Date.now(),
      email: email,
      name: email.split('@')[0],
      role: 'user',
      createdAt: new Date().toISOString()
    };

    const mockToken = 'mock-jwt-token-' + Date.now();

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: mockUser,
        token: mockToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log('Registration attempt for:', email);
    
    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required'
      });
    }

    // Mock successful registration
    const mockUser = {
      _id: 'user-' + Date.now(),
      name: name,
      email: email,
      role: 'user',
      createdAt: new Date().toISOString()
    };

    const mockToken = 'mock-jwt-token-' + Date.now();

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: mockUser,
        token: mockToken
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/auth/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Mock user verification
    const mockUser = {
      _id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      createdAt: new Date().toISOString()
    };

    return res.json({
      success: true,
      data: mockUser
    });
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication verification failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Database connection
async function connectToDatabase() {
  try {
    const mongoUri = process.env['MONGODB_URI'] || 'mongodb://localhost:27017/slidesdb';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    // Don't exit, allow server to run without DB for testing
  }
}

// Start server
async function startServer() {
  try {
    await connectToDatabase();
    
    app.listen(PORT, () => {
      console.log('🚀 Server started successfully!');
      console.log(`📍 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env['NODE_ENV'] || 'development'}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔌 API endpoint: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  try {
    await mongoose.connection.close();
    console.log('📊 Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

startServer();

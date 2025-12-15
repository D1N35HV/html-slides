import { Router } from 'express';
import AuthController from '../controllers/AuthController';
import ValidationService from '../services/ValidationService';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// POST /api/auth/register - Register new user
router.post(
  '/register',
  ValidationService.validateMiddleware(ValidationService.userRegistrationSchema),
  AuthController.register
);

// POST /api/auth/login - User login
router.post(
  '/login',
  ValidationService.validateMiddleware(ValidationService.userLoginSchema),
  AuthController.login
);

// GET /api/auth/me - Get current user profile
router.get(
  '/me',
  authenticateToken,
  AuthController.getProfile
);

// PUT /api/auth/me - Update user profile
router.put(
  '/me',
  authenticateToken,
  ValidationService.validateMiddleware(ValidationService.userUpdateSchema),
  AuthController.updateProfile
);

// POST /api/auth/refresh - Refresh access token
router.post(
  '/refresh',
  AuthController.refreshToken
);

// POST /api/auth/logout - User logout
router.post(
  '/logout',
  authenticateToken,
  AuthController.logout
);

export default router;

import { Router } from 'express';
import Joi from 'joi';
import PresentationController from '../controllers/PresentationController';
import ValidationService from '../services/ValidationService';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// NOTE: Public route must be defined BEFORE auth middleware so it remains publicly accessible
router.get(
  '/public',
  ValidationService.validateQuery(ValidationService.querySchema),
  PresentationController.getPublicPresentations
);

// Apply authentication middleware to subsequent routes
router.use(authenticateToken);

// GET /api/presentations - Get user's presentations
router.get(
  '/',
  ValidationService.validateQuery(ValidationService.querySchema),
  PresentationController.getUserPresentations
);

// GET /api/presentations/stats - Get user statistics
router.get(
  '/stats',
  PresentationController.getPresentationStats
);

// GET /api/presentations/:id - Get specific presentation
router.get(
  '/:id',
  PresentationController.getPresentationById
);

// POST /api/presentations - Create new presentation
router.post(
  '/',
  ValidationService.validateMiddleware(ValidationService.presentationSchema),
  PresentationController.createPresentation
);

// PUT /api/presentations/:id - Update presentation
router.put(
  '/:id',
  ValidationService.validateMiddleware(ValidationService.presentationUpdateSchema),
  PresentationController.updatePresentation
);

// DELETE /api/presentations/:id - Delete presentation
router.delete(
  '/:id',
  PresentationController.deletePresentation
);

// POST /api/presentations/:id/duplicate - Duplicate presentation
router.post(
  '/:id/duplicate',
  PresentationController.duplicatePresentation
);

// POST /api/presentations/:id/collaborators - Add collaborator
router.post(
  '/:id/collaborators',
  ValidationService.validateMiddleware(
    Joi.object({
      email: Joi.string().email().required()
    })
  ),
  PresentationController.addCollaborator
);

// DELETE /api/presentations/:id/collaborators/:collaboratorId - Remove collaborator
router.delete(
  '/:id/collaborators/:collaboratorId',
  PresentationController.removeCollaborator
);

export default router;

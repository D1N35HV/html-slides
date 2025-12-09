import { Request, Response } from 'express';
import PresentationService from '../services/PresentationService';
import { Types } from 'mongoose';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

class PresentationController {
  // Get all presentations for the authenticated user
  public async getUserPresentations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = new Types.ObjectId(req.user!.id);
  const { page: pageRaw, limit: limitRaw, search, tags } = req.query as Record<string, string | undefined>;
  const page = parseInt(pageRaw || '1');
  const limit = parseInt(limitRaw || '20');

      const result = await PresentationService.getUserPresentations(
        userId, 
        { page, limit, search, tags }
      );

      res.status(200).json({
        success: true,
        message: 'Presentations retrieved successfully',
        data: result.presentations,
        pagination: {
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          totalItems: result.total,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage
        }
      });
    } catch (error) {
      console.error('Error getting user presentations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve presentations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get public presentations
  public async getPublicPresentations(req: Request, res: Response): Promise<void> {
    try {
  const { page: pageRaw, limit: limitRaw, search, tags } = req.query as Record<string, string | undefined>;
  const page = parseInt(pageRaw || '1');
  const limit = parseInt(limitRaw || '20');

      const result = await PresentationService.getPublicPresentations(
        { page, limit, search, tags }
      );

      res.status(200).json({
        success: true,
        message: 'Public presentations retrieved successfully',
        data: result.presentations,
        pagination: {
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          totalItems: result.total,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage
        }
      });
    } catch (error) {
      console.error('Error getting public presentations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve public presentations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get a specific presentation by ID
  public async getPresentationById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const presentationId = req.params['id'];
      if (!presentationId) {
        res.status(400).json({ success: false, message: 'Presentation ID is required' });
        return;
      }
      const userId = req.user?.id ? new Types.ObjectId(req.user.id) : null;

  const presentation = await PresentationService.getPresentationById(presentationId, userId);

      if (!presentation) {
        res.status(404).json({
          success: false,
          message: 'Presentation not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Presentation retrieved successfully',
        data: presentation
      });
    } catch (error) {
      console.error('Error getting presentation by ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve presentation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Create a new presentation
  public async createPresentation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = new Types.ObjectId(req.user!.id);
  const presentationData = req.body;

      const presentation = await PresentationService.createPresentation(
        presentationData,
        userId
      );

      res.status(201).json({
        success: true,
        message: 'Presentation created successfully',
        data: presentation
      });
    } catch (error) {
      console.error('Error creating presentation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create presentation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update an existing presentation
  public async updatePresentation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const presentationId = req.params['id'];
      if (!presentationId) {
        res.status(400).json({ success: false, message: 'Presentation ID is required' });
        return;
      }
      const userId = new Types.ObjectId(req.user!.id);
  const updateData = req.body;

      const presentation = await PresentationService.updatePresentation(
        presentationId,
        updateData,
        userId
      );

      if (!presentation) {
        res.status(404).json({
          success: false,
          message: 'Presentation not found or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Presentation updated successfully',
        data: presentation
      });
    } catch (error) {
      console.error('Error updating presentation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update presentation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Delete a presentation
  public async deletePresentation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const presentationId = req.params['id'];
      if (!presentationId) {
        res.status(400).json({ success: false, message: 'Presentation ID is required' });
        return;
      }
      const userId = new Types.ObjectId(req.user!.id);

      const success = await PresentationService.deletePresentation(
        presentationId,
        userId
      );

      if (!success) {
        res.status(404).json({
          success: false,
          message: 'Presentation not found or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Presentation deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting presentation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete presentation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Duplicate a presentation
  public async duplicatePresentation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const presentationId = req.params['id'];
      if (!presentationId) {
        res.status(400).json({ success: false, message: 'Presentation ID is required' });
        return;
      }
      const userId = new Types.ObjectId(req.user!.id);

      const presentation = await PresentationService.duplicatePresentation(
        presentationId,
        userId
      );

      if (!presentation) {
        res.status(404).json({
          success: false,
          message: 'Presentation not found or unauthorized'
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Presentation duplicated successfully',
        data: presentation
      });
    } catch (error) {
      console.error('Error duplicating presentation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to duplicate presentation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Add collaborator to presentation
  public async addCollaborator(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const presentationId = req.params['id'];
      if (!presentationId) {
        res.status(400).json({ success: false, message: 'Presentation ID is required' });
        return;
      }
      const { email } = req.body;
      const userId = new Types.ObjectId(req.user!.id);

      const presentation = await PresentationService.addCollaborator(
        presentationId,
        email,
        userId
      );

      if (!presentation) {
        res.status(404).json({
          success: false,
          message: 'Presentation not found, user not found, or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Collaborator added successfully',
        data: presentation
      });
    } catch (error) {
      console.error('Error adding collaborator:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add collaborator',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Remove collaborator from presentation
  public async removeCollaborator(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const presentationId = req.params['id'];
      const collaboratorId = req.params['collaboratorId'];
      if (!presentationId || !collaboratorId) {
        res.status(400).json({ success: false, message: 'Presentation ID and collaborator ID are required' });
        return;
      }
      const userId = new Types.ObjectId(req.user!.id);

      const presentation = await PresentationService.removeCollaborator(
        presentationId,
        new Types.ObjectId(collaboratorId),
        userId
      );

      if (!presentation) {
        res.status(404).json({
          success: false,
          message: 'Presentation not found or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Collaborator removed successfully',
        data: presentation
      });
    } catch (error) {
      console.error('Error removing collaborator:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove collaborator',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get presentation statistics
  public async getPresentationStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = new Types.ObjectId(req.user!.id);
      const stats = await PresentationService.getUserStats(userId);

      res.status(200).json({
        success: true,
        message: 'Statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      console.error('Error getting presentation stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default new PresentationController();

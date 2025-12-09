import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import pptConverterService from '../services/PPTConverterService';

const router = Router();

// Ensure temp directory exists for PPT uploads
const tempDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for PPT file uploads
const pptStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

// File filter for PPT files
const pptFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.ms-powerpoint', // .ppt
  ];
  const allowedExtensions = ['.pptx', '.ppt'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PowerPoint files (.pptx, .ppt) are allowed.'));
  }
};

const pptUpload = multer({
  storage: pptStorage,
  fileFilter: pptFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max for PPT files
  }
});

// Apply authentication middleware
router.use(authenticateToken);

// POST /api/templates/upload - Upload a PPT file and convert to template
router.post('/upload', pptUpload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  const tempFilePath = req.file?.path;

  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
      return;
    }

    const userId = req.user?.id || 'anonymous';

    // Process the PPT file
    const templateInfo = await pptConverterService.processUploadedPPT(
      tempFilePath!,
      req.file.originalname,
      userId
    );

    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: templateInfo
    });
  } catch (error) {
    console.error('Template upload error:', error);

    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to process PowerPoint file'
    });
  }
});

// POST /api/templates/upload-stream - Upload PPT with streaming progress
// Slides are emitted via socket.io as they are parsed for real-time frontend sync
router.post('/upload-stream', pptUpload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  const tempFilePath = req.file?.path;

  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
      return;
    }

    const userId = req.user?.id || 'anonymous';

    // Get collaboration server from app context for socket.io events
    const collaborationServer = req.app.get('collaborationServer');

    // Process the PPT file with streaming
    // NOTE: Don't delete temp file here - service will delete after background parsing
    const templateInfo = await pptConverterService.processUploadedPPTStreaming(
      tempFilePath!,
      req.file.originalname,
      userId,
      (event) => {
        // Emit progress via socket.io
        if (collaborationServer && typeof collaborationServer.emitPPTProgress === 'function') {
          collaborationServer.emitPPTProgress(userId, event);
        }
      }
    );

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: templateInfo
    });
  } catch (error) {
    console.error('Streaming template upload error:', error);

    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to process PowerPoint file'
    });
  }
});

// GET /api/templates - Get all templates
router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = await pptConverterService.getTemplates();

    res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates'
    });
  }
});

// GET /api/templates/:id - Get a specific template
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templateId = req.params['id'];
    if (!templateId) {
      res.status(400).json({ success: false, message: 'Template ID is required' });
      return;
    }
    const template = await pptConverterService.getTemplate(templateId);

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Template not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template'
    });
  }
});

// GET /api/templates/:id/slides/:slideIndex - Get a specific slide from a template
router.get('/:id/slides/:slideIndex', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templateId = req.params['id'];
    const slideIndexStr = req.params['slideIndex'];

    if (!templateId || !slideIndexStr) {
      res.status(400).json({ success: false, message: 'Template ID and slide index are required' });
      return;
    }

    const slideIndex = parseInt(slideIndexStr, 10);

    if (isNaN(slideIndex) || slideIndex < 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid slide index'
      });
      return;
    }

    const slide = await pptConverterService.getTemplateSlide(templateId, slideIndex);

    if (!slide) {
      res.status(404).json({
        success: false,
        message: 'Slide not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: slide
    });
  } catch (error) {
    console.error('Error fetching slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch slide'
    });
  }
});

// DELETE /api/templates/:id - Delete a template
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templateId = req.params['id'];
    if (!templateId) {
      res.status(400).json({ success: false, message: 'Template ID is required' });
      return;
    }
    const deleted = await pptConverterService.deleteTemplate(templateId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Template not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete template'
    });
  }
});

export default router;

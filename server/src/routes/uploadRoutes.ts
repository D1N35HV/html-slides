import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { Response } from 'express';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
const imagesDir = path.join(uploadsDir, 'images');
const videosDir = path.join(uploadsDir, 'videos');

[uploadsDir, imagesDir, videosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    
    if (isImage) {
      cb(null, imagesDir);
    } else if (isVideo) {
      cb(null, videosDir);
    } else {
      cb(new Error('Invalid file type'), '');
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

// File filter for allowed types
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  
  if (allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF, WebP, SVG) and videos (MP4, WebM, OGG, MOV) are allowed.'));
  }
};

// Configure multer upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  }
});

// Apply authentication middleware
router.use(authenticateToken);

// POST /api/uploads - Upload a file (image or video)
router.post('/', upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
      return;
    }

    const isImage = req.file.mimetype.startsWith('image/');
    const fileType = isImage ? 'image' : 'video';
    const relativePath = isImage 
      ? `/uploads/images/${req.file.filename}`
      : `/uploads/videos/${req.file.filename}`;

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        id: uuidv4(),
        filename: req.file.filename,
        originalName: req.file.originalname,
        type: fileType,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: relativePath,
        userId: req.user?.id,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file'
    });
  }
});

// GET /api/uploads - Get user's uploaded files
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const type = req.query['type'] as string | undefined; // 'image' or 'video' or undefined for all
    
    // For now, we'll scan the directories and return all files
    // In a production environment with S3, this would query a database
    const files: any[] = [];
    
    const scanDirectory = (dir: string, fileType: string) => {
      if (fs.existsSync(dir)) {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
          const filePath = path.join(dir, item);
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            files.push({
              id: item.replace(/\.[^/.]+$/, ''),
              filename: item,
              type: fileType,
              url: `/uploads/${fileType}s/${item}`,
              size: stats.size,
              createdAt: stats.birthtime.toISOString()
            });
          }
        });
      }
    };

    if (!type || type === 'image') {
      scanDirectory(imagesDir, 'image');
    }
    if (!type || type === 'video') {
      scanDirectory(videosDir, 'video');
    }

    // Sort by creation date, newest first
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('Error fetching uploads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch uploads'
    });
  }
});

// DELETE /api/uploads/:filename - Delete an uploaded file
router.delete('/:filename', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filename = req.params['filename'];
    
    if (!filename) {
      res.status(400).json({
        success: false,
        message: 'Filename is required'
      });
      return;
    }
    
    // Try to find and delete the file from both directories
    const imagePath = path.join(imagesDir, filename);
    const videoPath = path.join(videosDir, filename);
    
    let deleted = false;
    
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      deleted = true;
    } else if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
      deleted = true;
    }
    
    if (deleted) {
      res.status(200).json({
        success: true,
        message: 'File deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

export default router;

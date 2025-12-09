import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: any;
}

// Custom Joi extension to validate URLs that can be either absolute URIs or relative paths
const urlOrPath = Joi.string().custom((value, helpers) => {
  if (!value) return value;
  
  // Allow absolute URLs (http, https, data URIs)
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
    return value;
  }
  
  // Allow relative paths starting with /
  if (value.startsWith('/')) {
    return value;
  }
  
  return helpers.error('string.uriOrPath');
}, 'URL or relative path').messages({
  'string.uriOrPath': '{{#label}} must be a valid URI or a relative path starting with /'
});

class ValidationService {
  // Define element and slide schemas BEFORE presentation schemas to avoid initialization order issues
  public static elementSchema = Joi.object({
    id: Joi.string().required(),
    type: Joi.string().valid('text', 'heading', 'image', 'video', 'shape').required(),
    position: Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required()
    }).required(),
    size: Joi.object({
      width: Joi.number().min(1).required(),
      height: Joi.number().min(1).required()
    }).required(),
    zIndex: Joi.number().min(0).optional(),
    rotation: Joi.number().min(-360).max(360).optional(),
    content: Joi.string().when('type', {
      is: Joi.string().valid('text', 'heading'),
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    level: Joi.number().valid(1, 2, 3, 4, 5, 6).when('type', { is: 'heading', then: Joi.required(), otherwise: Joi.forbidden() }),
    fontSize: Joi.number().min(8).max(200).optional(),
    fontFamily: Joi.string().optional(),
    fontWeight: Joi.string().valid('normal', 'bold', 'lighter', 'bolder').optional(),
    textAlign: Joi.string().valid('left', 'center', 'right', 'justify').optional(),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    backgroundColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    padding: Joi.number().min(0).optional(),
    lineHeight: Joi.number().min(0.5).max(3).optional(),
    imageUrl: urlOrPath.when('type', { is: 'image', then: Joi.required(), otherwise: Joi.forbidden() }),
    alt: Joi.string().optional(),
    objectFit: Joi.string().valid('cover', 'contain', 'fill', 'scale-down', 'none').optional(),
    borderRadius: Joi.number().min(0).optional(),
    opacity: Joi.number().min(0).max(1).optional(),
    filter: Joi.string().optional(),
    videoUrl: urlOrPath.when('type', { is: 'video', then: Joi.required(), otherwise: Joi.forbidden() }),
    autoplay: Joi.boolean().optional(),
    controls: Joi.boolean().optional(),
    muted: Joi.boolean().optional(),
    loop: Joi.boolean().optional(),
    poster: urlOrPath.optional(),
    shapeType: Joi.string().valid('rectangle','circle','triangle','arrow','diamond','pentagon','hexagon','star','heart','cloud','callout','parallelogram').when('type', { is: 'shape', then: Joi.required(), otherwise: Joi.forbidden() }),
    fillColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    borderColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    borderWidth: Joi.number().min(0).optional(),
    cornerRadius: Joi.number().min(0).optional(),
    gradient: Joi.object({
      type: Joi.string().valid('linear', 'radial').required(),
      colors: Joi.array().items(Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/)).min(2).required(),
      direction: Joi.number().min(0).max(360).optional()
    }).optional()
  });

  public static slideSchema = Joi.object({
    id: Joi.string().required(),
    title: Joi.string().trim().max(200).optional(),
    elements: Joi.array().items(ValidationService.elementSchema).optional(),
    backgroundColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    backgroundImage: urlOrPath.optional(),
    transition: Joi.string().optional(),
    order: Joi.number().min(0).required()
  });

  // Presentation validation schemas
  public static presentationSchema = Joi.object({
    title: Joi.string().trim().min(1).max(200).required(),
    description: Joi.string().trim().max(1000).optional(),
    theme: Joi.string().valid('default', 'dark', 'light', 'corporate', 'creative').optional(),
    isPublic: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string().trim().lowercase().max(50)).max(10).optional(),
    slides: Joi.array().items(ValidationService.slideSchema).optional()
  });

  // Separate schema for updates (all fields optional but at least one must be present)
  public static presentationUpdateSchema = Joi.object({
    title: Joi.string().trim().min(1).max(200).optional(),
    description: Joi.string().trim().max(1000).optional(),
    theme: Joi.string().valid('default', 'dark', 'light', 'corporate', 'creative').optional(),
    isPublic: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string().trim().lowercase().max(50)).max(10).optional(),
    slides: Joi.array().items(ValidationService.slideSchema).optional()
  }).min(1);


  // User validation schemas
  public static userRegistrationSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().min(6).required()
  });

  public static userLoginSchema = Joi.object({
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().required()
  });

  public static userUpdateSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).optional(),
    avatar: urlOrPath.optional(),
    preferences: Joi.object({
      theme: Joi.string().valid('light', 'dark', 'system').optional(),
      defaultTemplate: Joi.string().optional(),
      autoSave: Joi.boolean().optional(),
      notifications: Joi.boolean().optional()
    }).optional()
  });

  // Query validation schemas
  public static querySchema = Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    sort: Joi.string().valid('createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'title', '-title').default('-updatedAt'),
    search: Joi.string().trim().max(100).optional(),
    tags: Joi.string().optional(),
    isPublic: Joi.boolean().optional()
  });

  public static validate(schema: Joi.ObjectSchema, data: any): ValidationResult {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return {
        isValid: false,
        errors
      };
    }

    return {
      isValid: true,
      errors: [],
      data: value
    };
  }

  public static validateMiddleware(schema: Joi.ObjectSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const result = ValidationService.validate(schema, req.body);
      if (!result.isValid) {
        res.status(400).json({
          success: false,
            message: 'Validation failed',
            errors: result.errors
        });
        return;
      }
      req.body = result.data;
      next();
    };
  }

  public static validateQuery(schema: Joi.ObjectSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const result = ValidationService.validate(schema, req.query);
      if (!result.isValid) {
        res.status(400).json({
          success: false,
          message: 'Query validation failed',
          errors: result.errors
        });
        return;
      }
      req.query = result.data;
      next();
    };
  }
}

export default ValidationService;

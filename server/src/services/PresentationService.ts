import { Types } from 'mongoose';
import Presentation, { IPresentation } from '../models/Presentation';
import User from '../models/User';

interface PaginationOptions {
  page: number;
  limit: number;
  search?: string | undefined;
  tags?: string | undefined;
}

interface PaginatedResult<T> {
  presentations: T[];
  total: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface UserStats {
  totalPresentations: number;
  publicPresentations: number;
  privatePresentations: number;
  totalSlides: number;
  collaborations: number;
  recentActivity: Date;
}

class PresentationService {
  // Get paginated presentations for a user
  public async getUserPresentations(
    userId: Types.ObjectId,
    options: PaginationOptions
  ): Promise<PaginatedResult<IPresentation>> {
    const { page, limit, search, tags } = options;
    const skip = (page - 1) * limit;

    // Build search query
    const searchQuery: any = {
      $or: [
        { createdBy: userId },
        { collaborators: userId }
      ]
    };

    if (search) {
      searchQuery.$and = searchQuery.$and || [];
      searchQuery.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim().toLowerCase());
      searchQuery.$and = searchQuery.$and || [];
      searchQuery.$and.push({
        tags: { $in: tagArray }
      });
    }

    const [presentations, total] = await Promise.all([
      Presentation.find(searchQuery)
        .populate('createdBy', 'name email avatar')
        .populate('collaborators', 'name email avatar')
        .sort({ lastModified: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Presentation.countDocuments(searchQuery)
    ]);

    // Add thumbnailUrl from first slide and slideCount for dashboard cards
    const transformedPresentations = presentations.map((p: any) => ({
      ...p,
      slideCount: p.slides?.length || 0,
      thumbnailUrl: p.slides?.[0]?.thumbnailUrl || null
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      presentations: transformedPresentations as IPresentation[],
      total,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  // Get paginated public presentations
  public async getPublicPresentations(
    options: PaginationOptions
  ): Promise<PaginatedResult<IPresentation>> {
    const { page, limit, search, tags } = options;
    const skip = (page - 1) * limit;

    // Build search query
    const searchQuery: any = { isPublic: true };

    if (search) {
      searchQuery.$and = searchQuery.$and || [];
      searchQuery.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim().toLowerCase());
      searchQuery.$and = searchQuery.$and || [];
      searchQuery.$and.push({
        tags: { $in: tagArray }
      });
    }

    const [presentations, total] = await Promise.all([
      Presentation.find(searchQuery)
        .populate('createdBy', 'name email avatar')
        .sort({ lastModified: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Presentation.countDocuments(searchQuery)
    ]);

    // Add thumbnailUrl from first slide and slideCount for dashboard cards
    const transformedPresentations = presentations.map((p: any) => ({
      ...p,
      slideCount: p.slides?.length || 0,
      thumbnailUrl: p.slides?.[0]?.thumbnailUrl || null
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      presentations: transformedPresentations as IPresentation[],
      total,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  // Get a presentation by ID with access control
  public async getPresentationById(
    presentationId: string,
    userId?: Types.ObjectId | null
  ): Promise<IPresentation | null> {
    if (!Types.ObjectId.isValid(presentationId)) {
      return null;
    }

    const presentation: any = await Presentation.findById(presentationId)
      .populate('createdBy', 'name email avatar')
      .populate('collaborators', 'name email avatar')
      .lean();
    console.log(presentation);
    if (!presentation) {
      return null;
    }

    // Check access permissions
    const toIdString = (val: any) => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (val._id) return val._id.toString();
      if (val.toString) return val.toString();
      return null;
    };

    const userIdStr = userId ? userId.toString() : null;
    const createdById = toIdString(presentation.createdBy);
    const collaboratorIds = (presentation.collaborators || []).map((c: any) => toIdString(c));

    const hasAccess = presentation.isPublic || (userIdStr && (createdById === userIdStr || collaboratorIds.includes(userIdStr)));

    return hasAccess ? presentation as IPresentation : null;
  }

  // Create a new presentation
  public async createPresentation(
    presentationData: Partial<IPresentation>,
    userId: Types.ObjectId
  ): Promise<IPresentation> {
    const presentation = new Presentation({
      ...presentationData,
      createdBy: userId,
      slides: presentationData.slides || [],
      version: 1
    });

    return await presentation.save();
  }

  // Update an existing presentation
  public async updatePresentation(
    presentationId: string,
    updateData: Partial<IPresentation>,
    userId: Types.ObjectId
  ): Promise<IPresentation | null> {
    if (!Types.ObjectId.isValid(presentationId)) {
      return null;
    }

    // Strip fields the client must not control; version/lastModified are managed here
    const {
      version: _v,
      createdBy: _cb,
      _id: _id,
      __v: _vk,
      createdAt: _ca,
      updatedAt: _ua,
      lastModified: _lm,
      ...safeUpdate
    } = updateData as any;

    // Ensure slide order is consistent (the pre-save hook doesn't run on findOneAndUpdate)
    if (Array.isArray(safeUpdate.slides)) {
      safeUpdate.slides = safeUpdate.slides.map((slide: any, index: number) => ({
        ...slide,
        order: index
      }));
    }

    // Atomic update avoids the __v race between autosave, manual save, and realtime persist
    return await Presentation.findOneAndUpdate(
      {
        _id: presentationId,
        $or: [
          { createdBy: userId },
          { collaborators: userId }
        ]
      },
      {
        $set: { ...safeUpdate, lastModified: new Date() },
        $inc: { version: 1 }
      },
      { new: true, runValidators: true }
    );
  }

  // Delete a presentation
  public async deletePresentation(
    presentationId: string,
    userId: Types.ObjectId
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(presentationId)) {
      return false;
    }

    const result = await Presentation.findOneAndDelete({
      _id: presentationId,
      createdBy: userId // Only creator can delete
    });

    return !!result;
  }

  // Duplicate a presentation
  public async duplicatePresentation(
    presentationId: string,
    userId: Types.ObjectId
  ): Promise<IPresentation | null> {
    const originalPresentation = await this.getPresentationById(presentationId, userId);

    if (!originalPresentation) {
      return null;
    }

    const duplicatedPresentation = new Presentation({
      title: `${originalPresentation.title} (Copy)`,
      description: originalPresentation.description,
      slides: originalPresentation.slides,
      theme: originalPresentation.theme,
      isPublic: false, // Always private by default
      tags: originalPresentation.tags,
      createdBy: userId,
      version: 1
    });

    return await duplicatedPresentation.save();
  }

  // Add collaborator to presentation
  public async addCollaborator(
    presentationId: string,
    email: string,
    userId: Types.ObjectId
  ): Promise<IPresentation | null> {
    if (!Types.ObjectId.isValid(presentationId)) {
      return null;
    }

    // Find the user to add as collaborator
    const collaboratorUser = await User.findOne({ email: email.toLowerCase() });
    if (!collaboratorUser) {
      return null;
    }

    // Find presentation and check permissions
    const presentation = await Presentation.findOne({
      _id: presentationId,
      createdBy: userId // Only creator can add collaborators
    });

    if (!presentation) {
      return null;
    }

    // Add collaborator if not already added
    const collabIds = (presentation.collaborators || []) as Types.ObjectId[];
    const collaboratorObjectId = collaboratorUser._id as unknown as Types.ObjectId;
    if (!collabIds.some(id => id.equals(collaboratorObjectId))) {
      (presentation as any).collaborators = [...collabIds, collaboratorObjectId];
      await presentation.save();
    }

    return await Presentation.findById(presentationId)
      .populate('createdBy', 'name email avatar')
      .populate('collaborators', 'name email avatar');
  }

  // Remove collaborator from presentation
  public async removeCollaborator(
    presentationId: string,
    collaboratorId: Types.ObjectId,
    userId: Types.ObjectId
  ): Promise<IPresentation | null> {
    if (!Types.ObjectId.isValid(presentationId)) {
      return null;
    }

    // Find presentation and check permissions
    const presentation = await Presentation.findOne({
      _id: presentationId,
      createdBy: userId // Only creator can remove collaborators
    });

    if (!presentation) {
      return null;
    }

    (presentation as any).collaborators = (presentation.collaborators || []).filter((id: Types.ObjectId) => !id.equals(collaboratorId));
    await presentation.save();

    return await Presentation.findById(presentationId)
      .populate('createdBy', 'name email avatar')
      .populate('collaborators', 'name email avatar');
  }

  // Get user statistics
  public async getUserStats(userId: Types.ObjectId): Promise<UserStats> {
    const [
      totalPresentations,
      publicPresentations,
      privatePresentations,
      collaborations,
      recentPresentation
    ] = await Promise.all([
      Presentation.countDocuments({ createdBy: userId }),
      Presentation.countDocuments({ createdBy: userId, isPublic: true }),
      Presentation.countDocuments({ createdBy: userId, isPublic: false }),
      Presentation.countDocuments({ collaborators: userId }),
      Presentation.findOne({ createdBy: userId }).sort({ lastModified: -1 }).select('lastModified slides')
    ]);

    // Calculate total slides
    const userPresentations = await Presentation.find({ createdBy: userId }).select('slides');
    const totalSlides = userPresentations.reduce((total, presentation) => {
      return total + (presentation.slides?.length || 0);
    }, 0);

    return {
      totalPresentations,
      publicPresentations,
      privatePresentations,
      totalSlides,
      collaborations,
      recentActivity: recentPresentation?.lastModified || new Date()
    };
  }

  // Search presentations with advanced filters
  public async searchPresentations(
    query: string,
    filters: {
      tags?: string[];
      isPublic?: boolean;
      userId?: Types.ObjectId;
    },
    options: PaginationOptions
  ): Promise<PaginatedResult<IPresentation>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const searchQuery: any = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } }
      ]
    };

    if (filters.isPublic !== undefined) {
      searchQuery.isPublic = filters.isPublic;
    }

    if (filters.tags && filters.tags.length > 0) {
      searchQuery.tags = { $in: filters.tags };
    }

    if (filters.userId) {
      searchQuery.$and = searchQuery.$and || [];
      searchQuery.$and.push({
        $or: [
          { createdBy: filters.userId },
          { collaborators: filters.userId }
        ]
      });
    }

    const [presentations, total] = await Promise.all([
      Presentation.find(searchQuery)
        .populate('createdBy', 'name email avatar')
        .populate('collaborators', 'name email avatar')
        .sort({ lastModified: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Presentation.countDocuments(searchQuery)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      presentations: presentations as IPresentation[],
      total,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }
}

export default new PresentationService();

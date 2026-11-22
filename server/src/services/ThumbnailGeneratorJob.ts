import Presentation from '../models/Presentation';
import thumbnailService from './ThumbnailService';

interface SlideWithMissingThumbnail {
    presentationId: string;
    slideId: string;
    slideIndex: number;
    slideData: any;
}

/**
 * Background job service that periodically scans for slides with missing
 * or expired thumbnails and generates them using the ThumbnailService.
 */
class ThumbnailGeneratorJob {
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning = false;
    private intervalMs: number;

    constructor(intervalMs: number = 30000) {
        this.intervalMs = intervalMs;
    }

    /**
     * Start the background thumbnail generation job
     */
    start(): void {
        if (this.intervalId) {
            console.log('⚠️ ThumbnailGeneratorJob is already running');
            return;
        }

        console.log(`🔄 Starting ThumbnailGeneratorJob (interval: ${this.intervalMs}ms)`);

        // Run once immediately, then on interval
        this.processOnce();
        this.intervalId = setInterval(() => this.processOnce(), this.intervalMs);
    }

    /**
     * Stop the background thumbnail generation job
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('🛑 ThumbnailGeneratorJob stopped');
        }
    }

    /**
     * Run one pass: find slides with missing thumbnails and generate them
     */
    async processOnce(): Promise<void> {
        if (this.isRunning) {
            console.log('⏳ ThumbnailGeneratorJob: Previous run still in progress, skipping');
            return;
        }

        this.isRunning = true;

        try {
            const slidesWithMissingThumbnails = await this.findSlidesWithMissingThumbnails();

            if (slidesWithMissingThumbnails.length === 0) {
                // No missing thumbnails, silent return
                return;
            }

            console.log(`🖼️ ThumbnailGeneratorJob: Found ${slidesWithMissingThumbnails.length} slides needing thumbnails`);

            for (const slide of slidesWithMissingThumbnails) {
                try {
                    await this.processPresentationSlide(slide);
                } catch (error) {
                    console.error(`❌ Failed to generate thumbnail for slide ${slide.slideId}:`, error);
                }
            }

            console.log(`✅ ThumbnailGeneratorJob: Processed ${slidesWithMissingThumbnails.length} slides`);
        } catch (error) {
            console.error('❌ ThumbnailGeneratorJob error:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Query the database for slides that have null/empty thumbnailUrl OR thumbnailExpired flag
     */
    private async findSlidesWithMissingThumbnails(): Promise<SlideWithMissingThumbnail[]> {
        const result: SlideWithMissingThumbnail[] = [];

        try {
            // Find presentations with at least one slide that has null/empty thumbnailUrl OR expired flag
            const presentations = await Presentation.find({
                $or: [
                    { 'slides.thumbnailUrl': { $in: [null, '', undefined] } },
                    { 'slides.thumbnailExpired': true }
                ]
            }).select('_id slides').lean();

            for (const presentation of presentations) {
                const presentationId = presentation._id.toString();
                const slides = presentation.slides || [];

                for (let i = 0; i < slides.length; i++) {
                    const slide = slides[i] as any;
                    // Check for null/empty OR expired
                    if (!slide.thumbnailUrl || slide.thumbnailExpired) {
                        result.push({
                            presentationId,
                            slideId: slide.id,
                            slideIndex: i,
                            slideData: slide
                        });
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error querying slides with missing thumbnails:', error);
        }

        return result;
    }

    /**
     * Generate thumbnail for a specific slide and update the database
     */
    private async processPresentationSlide(slide: SlideWithMissingThumbnail): Promise<void> {
        const { presentationId, slideId, slideIndex, slideData } = slide;

        return new Promise<void>((resolve, reject) => {
            thumbnailService.queueThumbnailGeneration(
                presentationId,
                slideId,
                slideIndex,
                async (thumbnailUrl: string) => {
                    try {
                        // Update the slide's thumbnailUrl and clear the expired flag
                        await Presentation.updateOne(
                            { _id: presentationId, 'slides.id': slideId },
                            {
                                $set: { 'slides.$.thumbnailUrl': thumbnailUrl },
                                $unset: { 'slides.$.thumbnailExpired': '' }
                            }
                        );
                        console.log(`📸 Generated thumbnail for slide ${slideIndex + 1} in presentation ${presentationId}`);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                },
                slideData
            );
        });
    }
}

// Export singleton instance
export const thumbnailGeneratorJob = new ThumbnailGeneratorJob();
export default thumbnailGeneratorJob;

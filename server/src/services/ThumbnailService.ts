import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

// Slide element types matching frontend
interface SlideElement {
    id: string;
    type: 'text' | 'heading' | 'image' | 'video' | 'shape' | 'chart';
    content?: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    rotation?: number;
    zIndex?: number;
    imageUrl?: string;
    videoUrl?: string;
    shapeType?: string;
    fillColor?: string;
    borderColor?: string;
    borderWidth?: number;
    cornerRadius?: number;
    opacity?: number;
    backgroundColor?: string;
    // Chart fields. The server-side ThumbnailService can't run recharts —
    // it renders a placeholder so the slide thumbnail remains coherent.
    // Production thumbnails come from the client-side rasterize-at-save
    // path (Q14), which captures the real recharts SVG.
    chartType?: 'bar' | 'line' | 'pie' | 'area';
    title?: string;
}

interface SlideData {
    id: string;
    elements: SlideElement[];
    backgroundColor?: string | undefined;
    backgroundImage?: string | undefined;
}

interface ThumbnailJob {
    slideId: string;
    slideIndex: number;
    presentationId: string;
    callback: (thumbnailUrl: string) => void;
    // Keep slideData for fallback rendering
    slideData?: SlideData | undefined;
}

interface ThumbnailOptions {
    width?: number;
    height?: number;
    quality?: number;
}

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;
const DEBOUNCE_MS = 500; // Increased debounce for route-based rendering

class ThumbnailService extends EventEmitter {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private isInitializing = false;
    private uploadsDir: string;
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private pendingJobs: Map<string, ThumbnailJob> = new Map();
    private serverBaseUrl: string;
    private frontendBaseUrl: string;

    constructor() {
        super();
        this.uploadsDir = path.join(__dirname, '../../uploads');
        this.serverBaseUrl = process.env['SERVER_URL'] || 'http://localhost:3001';
        this.frontendBaseUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';

        // Ensure uploads directory exists
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }

        console.log('[ThumbnailService] Initialized');
        console.log('  Uploads dir:', this.uploadsDir);
        console.log('  Frontend URL:', this.frontendBaseUrl);
    }

    /**
     * Initialize persistent Puppeteer browser instance
     */
    async initialize(): Promise<void> {
        if (this.browser || this.isInitializing) {
            return;
        }

        this.isInitializing = true;

        try {
            console.log('[ThumbnailService] Launching Puppeteer browser...');

            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1200,900'
                ]
            });

            // Create a persistent page for rendering
            this.page = await this.browser.newPage();
            await this.page.setViewport({
                width: SLIDE_WIDTH + 100,
                height: SLIDE_HEIGHT + 100,
                deviceScaleFactor: 1
            });

            console.log('[ThumbnailService] Browser initialized successfully');
        } catch (error) {
            console.error('[ThumbnailService] Failed to initialize browser:', error);
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Shutdown the browser instance
     */
    async shutdown(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log('[ThumbnailService] Browser shutdown complete');
        }
    }

    /**
     * Queue a thumbnail generation job with debouncing
     * Uses the frontend present route for rendering
     */
    queueThumbnailGeneration(
        presentationId: string,
        slideId: string,
        slideIndex: number,
        callback: (thumbnailUrl: string) => void,
        slideData?: SlideData
    ): void {
        // Clear existing debounce timer
        const existingTimer = this.debounceTimers.get(slideId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Store the job
        this.pendingJobs.set(slideId, { slideId, slideIndex, presentationId, callback, slideData });

        // Set new debounce timer
        const timer = setTimeout(async () => {
            this.debounceTimers.delete(slideId);
            const job = this.pendingJobs.get(slideId);
            if (job) {
                this.pendingJobs.delete(slideId);
                await this.processJob(job);
            }
        }, DEBOUNCE_MS);

        this.debounceTimers.set(slideId, timer);
    }

    /**
     * Process a single thumbnail job
     * Uses HTML-based rendering as it's faster and doesn't require frontend auth
     */
    private async processJob(job: ThumbnailJob): Promise<void> {
        try {
            // Use HTML-based rendering (faster and doesn't require frontend to be running)
            if (job.slideData) {
                const thumbnailUrl = await this.renderSlideThumbnail(
                    job.presentationId,
                    job.slideIndex,
                    job.slideData
                );
                job.callback(thumbnailUrl);
            } else {
                console.warn(`[ThumbnailService] No slide data available for ${job.slideId}, skipping thumbnail generation`);
            }
        } catch (error) {
            console.error(`[ThumbnailService] Failed to generate thumbnail for slide ${job.slideId}:`, error);
        }
    }

    /**
     * Render a slide thumbnail by navigating to the frontend thumbnail route
     * (Reserved for future use - currently using HTML-based rendering)
     */
    async renderSlideThumbnailViaRoute(
        presentationId: string,
        _slideId: string,
        slideIndex: number
    ): Promise<string> {
        // Ensure browser is initialized
        if (!this.browser || !this.page) {
            await this.initialize();
        }

        if (!this.page) {
            throw new Error('Failed to initialize browser page');
        }

        // Create presentation-specific thumbnail directory
        const thumbnailDir = path.join(this.uploadsDir, 'presentations', presentationId, 'thumbnails');
        if (!fs.existsSync(thumbnailDir)) {
            fs.mkdirSync(thumbnailDir, { recursive: true });
        }

        const thumbnailUrl = `${this.frontendBaseUrl}/thumbnail/${presentationId}/${slideIndex}`;
        console.log(`[ThumbnailService] Navigating to: ${thumbnailUrl}`);

        try {
            // Navigate to the thumbnail route
            await this.page.goto(thumbnailUrl, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Wait for the thumbnail to be ready
            await this.page.waitForFunction(
                `document.querySelector('[data-thumbnail-ready="true"]') !== null`,
                { timeout: 10000 }
            ).catch(() => {
                console.log('[ThumbnailService] Timeout waiting for thumbnail ready, proceeding anyway');
            });

            // Give a little extra time for final rendering
            await new Promise(resolve => setTimeout(resolve, 200));

            // Find the thumbnail container
            const slideElement = await this.page.$('#thumbnail-container');
            if (!slideElement) {
                throw new Error('Could not find thumbnail container');
            }

            // Generate filename with sequential numbering
            const slideNumber = String(slideIndex + 1).padStart(4, '0');
            const filename = `${slideNumber}.png`;
            const filepath = path.join(thumbnailDir, filename);

            // Take screenshot
            await slideElement.screenshot({
                path: filepath as `${string}.png`,
                type: 'png',
                omitBackground: false
            });

            const resultUrl = `/uploads/presentations/${presentationId}/thumbnails/${filename}`;
            console.log(`[ThumbnailService] Generated thumbnail via route: ${resultUrl}`);

            return resultUrl;
        } catch (error) {
            console.error('[ThumbnailService] Error rendering thumbnail via route:', error);
            throw error;
        }
    }

    /**
     * Render a slide to a PNG thumbnail using self-generated HTML
     * Stores thumbnails in presentation-specific folders with sequential naming
     */
    async renderSlideThumbnail(
        presentationId: string,
        slideIndex: number,
        slideData: SlideData,
        _options: ThumbnailOptions = {}
    ): Promise<string> {
        // Ensure browser is initialized
        if (!this.browser || !this.page) {
            await this.initialize();
        }

        if (!this.page) {
            throw new Error('Failed to initialize browser page');
        }

        // Create presentation-specific thumbnail directory
        const thumbnailDir = path.join(this.uploadsDir, 'presentations', presentationId, 'thumbnails');
        if (!fs.existsSync(thumbnailDir)) {
            fs.mkdirSync(thumbnailDir, { recursive: true });
        }

        try {
            // Generate HTML for the slide
            const html = this.generateSlideHTML(slideData);

            // Set the page content
            await this.page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });

            // Wait a bit for any images to load
            await this.page.waitForFunction(
                `(function() {
                    const images = document.querySelectorAll('img');
                    return images.length === 0 || Array.from(images).every(img => img.complete);
                })()`,
                { timeout: 5000 }
            ).catch(() => {
                // Timeout is fine, continue with screenshot
            });

            // Select the slide container and take a screenshot
            const slideElement = await this.page.$('#slide-container');

            if (!slideElement) {
                throw new Error('Could not find slide container');
            }

            // Generate filename with sequential numbering (0001.png, 0002.png, etc.)
            const slideNumber = String(slideIndex + 1).padStart(4, '0');
            const filename = `${slideNumber}.png`;
            const filepath = path.join(thumbnailDir, filename);

            // Take screenshot
            await slideElement.screenshot({
                path: filepath as `${string}.png`,
                type: 'png',
                omitBackground: false
            });

            const thumbnailUrl = `/uploads/presentations/${presentationId}/thumbnails/${filename}`;
            console.log(`[ThumbnailService] Generated thumbnail: ${thumbnailUrl}`);

            return thumbnailUrl;
        } catch (error) {
            console.error('[ThumbnailService] Error rendering thumbnail:', error);
            throw error;
        }
    }

    /**
     * Generate HTML template for a slide (fallback method)
     */
    private generateSlideHTML(slideData: SlideData): string {
        const backgroundColor = slideData.backgroundColor || '#ffffff';
        const backgroundImage = slideData.backgroundImage
            ? `url(${this.resolveImageUrl(slideData.backgroundImage)})`
            : 'none';

        const elementsHTML = slideData.elements
            .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
            .map(element => this.renderElementToHTML(element))
            .join('\n');

        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${SLIDE_WIDTH + 100}px;
      height: ${SLIDE_HEIGHT + 100}px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #888;
    }
    #slide-container {
      width: ${SLIDE_WIDTH}px;
      height: ${SLIDE_HEIGHT}px;
      position: relative;
      background-color: ${backgroundColor};
      background-image: ${backgroundImage};
      background-size: cover;
      background-position: center;
      overflow: hidden;
      font-family: Arial, Helvetica, sans-serif;
    }
    .element { position: absolute; overflow: hidden; }
    .text-element, .heading-element { word-wrap: break-word; }
    .text-element p, .heading-element h1, .heading-element h2, .heading-element h3 { margin: 0; }
    .image-element img { width: 100%; height: 100%; object-fit: cover; }
    .shape-element svg { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="slide-container">
    ${elementsHTML}
  </div>
</body>
</html>`.trim();
    }

    /**
     * Render a single element to HTML
     */
    private renderElementToHTML(element: SlideElement): string {
        const { position, size, rotation = 0, zIndex = 0 } = element;

        const transform = rotation ? `rotate(${rotation}deg)` : 'none';
        const baseStyle = `left:${position.x}px;top:${position.y}px;width:${size.width}px;height:${size.height}px;z-index:${zIndex};transform:${transform};transform-origin:center;`;

        switch (element.type) {
            case 'text':
            case 'heading': {
                const bgColor = element.backgroundColor || 'transparent';
                return `<div class="element ${element.type}-element" style="${baseStyle}background-color:${bgColor};">${element.content || ''}</div>`;
            }

            case 'image': {
                const imageUrl = this.resolveImageUrl(element.imageUrl || '');
                const opacity = element.opacity !== undefined ? element.opacity : 1;
                return `<div class="element image-element" style="${baseStyle}opacity:${opacity};"><img src="${imageUrl}" alt="" crossorigin="anonymous"/></div>`;
            }

            case 'video': {
                return `<div class="element video-element" style="${baseStyle}background:#000;display:flex;align-items:center;justify-content:center;"><svg width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>`;
            }

            case 'shape': {
                return this.renderShapeToHTML(element, baseStyle);
            }

            case 'chart': {
                // Placeholder thumbnail — recharts isn't available
                // server-side, so we draw a quiet rectangle with the chart
                // title (or chart type as fallback) centered. Production
                // thumbnails via the client save-time rasterizer carry the
                // real chart visual.
                const label = element.title || (element.chartType
                    ? `${element.chartType[0]?.toUpperCase()}${element.chartType.slice(1)} chart`
                    : 'Chart');
                const safeLabel = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return `<div class="element chart-element" style="${baseStyle}background:#f4f3ee;border:1px solid #d8d4c5;display:flex;align-items:center;justify-content:center;color:#5a5648;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;letter-spacing:0.02em;">${safeLabel}</div>`;
            }

            default:
                return '';
        }
    }

    /**
     * Render a shape element to HTML/SVG
     */
    private renderShapeToHTML(element: SlideElement, baseStyle: string): string {
        const fillColor = element.fillColor || '#3B82F6';
        const borderColor = element.borderColor || '#1E40AF';
        const borderWidth = element.borderWidth || 2;
        const opacity = element.opacity !== undefined ? element.opacity : 1;
        const shapeType = element.shapeType || 'rectangle';

        let shapeContent = '';
        switch (shapeType) {
            case 'rectangle':
                shapeContent = `<rect x="5" y="5" width="90" height="90" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}"/>`;
                break;
            case 'circle':
                shapeContent = `<ellipse cx="50" cy="50" rx="45" ry="45" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}"/>`;
                break;
            case 'triangle':
                shapeContent = `<polygon points="50,5 95,95 5,95" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}"/>`;
                break;
            case 'star':
                shapeContent = `<polygon points="50,5 61,40 98,40 68,62 79,97 50,75 21,97 32,62 2,40 39,40" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}"/>`;
                break;
            case 'arrow':
                shapeContent = `<polygon points="5,50 40,20 40,40 95,40 95,60 40,60 40,80" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}"/>`;
                break;
            case 'diamond':
                shapeContent = `<polygon points="50,5 95,50 50,95 5,50" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}"/>`;
                break;
            default:
                shapeContent = `<rect x="5" y="5" width="90" height="90" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}"/>`;
        }

        return `<div class="element shape-element" style="${baseStyle}opacity:${opacity};"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${shapeContent}</svg></div>`;
    }

    /**
     * Resolve image URLs to absolute URLs that Puppeteer can load
     * For local files, convert to base64 data URIs for reliable loading
     */
    private resolveImageUrl(url: string): string {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
            return url;
        }
        // Convert /uploads/... paths to base64 data URIs
        if (url.startsWith('/uploads/')) {
            try {
                const filePath = path.join(this.uploadsDir, url.replace('/uploads/', ''));
                if (fs.existsSync(filePath)) {
                    const imageBuffer = fs.readFileSync(filePath);
                    const base64 = imageBuffer.toString('base64');
                    // Determine MIME type from extension
                    const ext = path.extname(filePath).toLowerCase();
                    const mimeTypes: Record<string, string> = {
                        '.png': 'image/png',
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.gif': 'image/gif',
                        '.webp': 'image/webp',
                        '.svg': 'image/svg+xml',
                        '.bmp': 'image/bmp'
                    };
                    const mimeType = mimeTypes[ext] || 'image/png';
                    return `data:${mimeType};base64,${base64}`;
                }
                console.warn(`[ThumbnailService] Image file not found: ${filePath}`);
            } catch (error) {
                console.error(`[ThumbnailService] Error reading image file: ${error}`);
            }
            // Fallback to server URL if file reading fails
            return `${this.serverBaseUrl}${url}`;
        }
        if (url.startsWith('/')) {
            return `${this.serverBaseUrl}${url}`;
        }
        return url;
    }

    /**
     * Clean up stale presentation thumbnail directories
     * Removes thumbnail folders for presentations that no longer exist
     */
    async cleanupStaleThumbnails(_maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
        // This method is now a no-op since thumbnails are stored per-presentation
        // and will be cleaned up when the presentation is deleted
        console.log('[ThumbnailService] Thumbnail cleanup is handled per-presentation');
    }

    /**
     * Get the thumbnail URL for a slide if it exists
     */
    getThumbnailUrl(presentationId: string, slideIndex: number): string | null {
        try {
            const slideNumber = String(slideIndex + 1).padStart(4, '0');
            const filename = `${slideNumber}.png`;
            const thumbnailDir = path.join(this.uploadsDir, 'presentations', presentationId, 'thumbnails');
            const filepath = path.join(thumbnailDir, filename);

            if (fs.existsSync(filepath)) {
                return `/uploads/presentations/${presentationId}/thumbnails/${filename}`;
            }
        } catch (error) { /* ignore */ }
        return null;
    }
}

export const thumbnailService = new ThumbnailService();
export default thumbnailService;

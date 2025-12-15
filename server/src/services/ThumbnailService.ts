import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

// Slide element types matching frontend
interface SlideElement {
    id: string;
    type: 'text' | 'heading' | 'image' | 'video' | 'shape';
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
}

interface SlideData {
    id: string;
    elements: SlideElement[];
    backgroundColor?: string;
    backgroundImage?: string;
}

interface ThumbnailJob {
    slideId: string;
    slideData: SlideData;
    callback: (thumbnailUrl: string) => void;
    presentationId?: string | undefined;
}

interface ThumbnailOptions {
    width?: number;
    height?: number;
    quality?: number;
}

const SLIDE_WIDTH = 1024;
const SLIDE_HEIGHT = 768;
const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 240;
const DEBOUNCE_MS = 300;

class ThumbnailService extends EventEmitter {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private isInitializing = false;
    private thumbnailsDir: string;
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private pendingJobs: Map<string, ThumbnailJob> = new Map();
    private serverBaseUrl: string;

    constructor() {
        super();
        this.thumbnailsDir = path.join(__dirname, '../../uploads/thumbnails');
        this.serverBaseUrl = process.env['SERVER_URL'] || 'http://localhost:3001';

        // Ensure thumbnails directory exists
        if (!fs.existsSync(this.thumbnailsDir)) {
            fs.mkdirSync(this.thumbnailsDir, { recursive: true });
        }

        console.log('[ThumbnailService] Initialized');
        console.log('  Thumbnails dir:', this.thumbnailsDir);
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
     */
    queueThumbnailGeneration(
        slideId: string,
        slideData: SlideData,
        callback: (thumbnailUrl: string) => void,
        presentationId?: string
    ): void {
        // Clear existing debounce timer
        const existingTimer = this.debounceTimers.get(slideId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Store the job
        this.pendingJobs.set(slideId, { slideId, slideData, callback, presentationId });

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
     */
    private async processJob(job: ThumbnailJob): Promise<void> {
        try {
            const thumbnailUrl = await this.renderSlideThumbnail(
                job.slideId,
                job.slideData,
                { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }
            );
            job.callback(thumbnailUrl);
        } catch (error) {
            console.error(`[ThumbnailService] Failed to generate thumbnail for slide ${job.slideId}:`, error);
        }
    }

    /**
     * Render a slide to a PNG thumbnail
     */
    async renderSlideThumbnail(
        slideId: string,
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

        try {
            // Generate HTML for the slide
            const html = this.generateSlideHTML(slideData);

            // Set the page content
            await this.page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });

            // Wait a bit for any images to load
            // Use waitForFunction with string to avoid TypeScript issues with document in Node context
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

            // Generate filename with timestamp
            const timestamp = Date.now();
            const filename = `${slideId}-${timestamp}.png`;
            const filepath = path.join(this.thumbnailsDir, filename);

            // Take screenshot
            await slideElement.screenshot({
                path: filepath as `${string}.png`,
                type: 'png',
                omitBackground: false
            });

            // Clean up old thumbnails for this slide
            await this.cleanupOldThumbnails(slideId, filename);

            const thumbnailUrl = `/thumbnails/${filename}`;
            console.log(`[ThumbnailService] Generated thumbnail: ${thumbnailUrl}`);

            return thumbnailUrl;
        } catch (error) {
            console.error('[ThumbnailService] Error rendering thumbnail:', error);
            throw error;
        }
    }

    /**
     * Generate HTML template for a slide
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
     * Resolve image URLs to absolute URLs
     */
    private resolveImageUrl(url: string): string {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
            return url;
        }
        if (url.startsWith('/')) {
            return `${this.serverBaseUrl}${url}`;
        }
        return url;
    }

    /**
     * Clean up old thumbnails for a slide
     */
    private async cleanupOldThumbnails(slideId: string, keepFilename: string): Promise<void> {
        try {
            const files = fs.readdirSync(this.thumbnailsDir);
            const slideFiles = files.filter(f => f.startsWith(slideId) && f !== keepFilename);
            for (const file of slideFiles) {
                try {
                    fs.unlinkSync(path.join(this.thumbnailsDir, file));
                } catch (e) { /* ignore */ }
            }
        } catch (error) { /* ignore */ }
    }

    /**
     * Clean up all stale thumbnails
     */
    async cleanupStaleThumbnails(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
        try {
            const now = Date.now();
            const files = fs.readdirSync(this.thumbnailsDir);
            for (const file of files) {
                const filepath = path.join(this.thumbnailsDir, file);
                const stats = fs.statSync(filepath);
                if (now - stats.mtimeMs > maxAgeMs) {
                    fs.unlinkSync(filepath);
                    console.log(`[ThumbnailService] Cleaned up stale thumbnail: ${file}`);
                }
            }
        } catch (error) {
            console.error('[ThumbnailService] Error cleaning up stale thumbnails:', error);
        }
    }

    /**
     * Get the thumbnail URL for a slide if it exists
     */
    getThumbnailUrl(slideId: string): string | null {
        try {
            const files = fs.readdirSync(this.thumbnailsDir);
            const slideFile = files.filter(f => f.startsWith(slideId)).sort().pop();
            if (slideFile) {
                return `/thumbnails/${slideFile}`;
            }
        } catch (error) { /* ignore */ }
        return null;
    }
}

export const thumbnailService = new ThumbnailService();
export default thumbnailService;

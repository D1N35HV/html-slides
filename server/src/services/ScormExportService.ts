import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Presentation } from '../models/Presentation';
import axios from 'axios';

export class ScormExportService {
  constructor(private outputDir: string, private viewerBuildDir: string) {}

  public async exportPresentation(presentationId: string, outputStream: NodeJS.WritableStream): Promise<void> {
    const presentation = await Presentation.findById(presentationId);
    if (!presentation) throw new Error('Presentation not found');

    const tempDir = path.join(this.outputDir, `scorm_${crypto.randomUUID()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      // 1. Process JSON and extract media
      const { updatedSlides } = await this.processMedia(presentation.slides, tempDir);

      // 2. Format HTML
      let htmlTemplate = fs.readFileSync(path.join(this.viewerBuildDir, 'scorm.html'), 'utf-8');
      
      const jsonInjection = `window.__SLIDES_DATA__ = ${JSON.stringify(updatedSlides)};`;
      htmlTemplate = htmlTemplate.replace(
        /<script id="scorm-data-injection">[\s\S]*?<\/script>/i, 
        `<script id="scorm-data-injection">${jsonInjection}</script>`
      );
      
      const phtml = path.join(tempDir, 'index.html');
      fs.writeFileSync(phtml, htmlTemplate);
      
      // Copy viewer static files (Vite build output)
      // Assuming Vite outputs an 'assets' folder and SCORM JS logic inside
      const assetsSrc = path.join(this.viewerBuildDir, 'assets');
      if (fs.existsSync(assetsSrc)) {
        this.copyDirectorySync(assetsSrc, path.join(tempDir, 'assets'));
      }

      // 3. Manifest
      const manifestPath = path.join(tempDir, 'imsmanifest.xml');
      fs.writeFileSync(manifestPath, this.generateManifest(presentation.title || 'Export Course'));

      // 4. Archive
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(outputStream);
      archive.directory(tempDir, false);
      await archive.finalize();

    } finally {
      // Cleanup
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }

  private async processMedia(slides: any[], tempDir: string) {
    const assetsDir = path.join(tempDir, 'scorm_media');
    fs.mkdirSync(assetsDir, { recursive: true });

    const assetsMap = new Map<string, string>(); // url -> localFilename
    const updatedSlides = JSON.parse(JSON.stringify(slides)); // deep copy

    const processUrl = async (url: string) => {
      if (!url || url.startsWith('data:')) return url;
      let localPath = assetsMap.get(url);
      if (!localPath) {
        localPath = await this.downloadAsset(url, assetsDir);
        assetsMap.set(url, localPath);
      }
      return `./scorm_media/${localPath}`;
    };

    // Loop through slides and elements to find URLs
    for (const slide of updatedSlides) {
      if (slide.backgroundImage) {
        slide.backgroundImage = await processUrl(slide.backgroundImage);
      }

      if (!slide.elements) continue;
      for (const element of slide.elements) {
        if (element.imageUrl) {
           element.imageUrl = await processUrl(element.imageUrl);
        }
        if (element.videoUrl) {
           element.videoUrl = await processUrl(element.videoUrl);
        }
        if (element.content) {
           const imgRegex = /<img[^>]+src="([^">]+)"/g;
           let match;
           let newContent = element.content;
           const urls: string[] = [];
           while ((match = imgRegex.exec(element.content)) !== null) {
             if (match[1]) urls.push(match[1]);
           }
           for (const u of urls) {
             const newU = await processUrl(u);
             newContent = newContent.replace(u, newU);
           }
           element.content = newContent;
        }
      }
    }
    return { updatedSlides, assetsMap };
  }

  private async downloadAsset(url: string, outputDir: string): Promise<string> {
    try {
      let pathname = '';
      try {
        pathname = new URL(url).pathname;
      } catch (e) {
        pathname = url;
      }
      
      const ext = path.extname(pathname) || '.jpg';
      const filename = `asset_${crypto.randomBytes(4).toString('hex')}${ext}`;
      const dest = path.join(outputDir, filename);

      if (url.startsWith('http')) {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });
        const writer = fs.createWriteStream(dest);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(filename));
            writer.on('error', reject);
        });
      } else {
        // It's a local file in the server uploads directory
        const cleanUrl = url.replace(/^\/+/, '');
        const localSrc = path.join(process.cwd(), cleanUrl);
        if (fs.existsSync(localSrc)) {
           fs.copyFileSync(localSrc, dest);
        } else {
           console.warn(`[ScormExport] Missing local file: ${localSrc}`);
        }
        return filename;
      }
    } catch(e) {
      console.warn(`[ScormExport] Failed to download media: ${url}`);
      return "missing.png";
    }
  }

  private generateManifest(title: string): string {
    return `<?xml version="1.0" standalone="no" ?>
<manifest identifier="SlideBoltCourse" version="1.3"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="SlideBoltOrg">
    <organization identifier="SlideBoltOrg">
      <title>${title}</title>
      <item identifier="item_1" identifierref="resource_1">
        <title>${title}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="resource_1" type="webcontent" href="index.html" adlcp:scormtype="sco">
      <file href="index.html" />
    </resource>
  </resources>
</manifest>`;
  }

  private copyDirectorySync(src: string, dest: string) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        entry.isDirectory() ? this.copyDirectorySync(srcPath, destPath) : fs.copyFileSync(srcPath, destPath);
    }
  }
}

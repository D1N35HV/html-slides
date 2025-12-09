import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Presentation from '../models/Presentation';

// Types for PPT parser output
interface PPTPosition {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PPTRun {
  text: string;
  font_name: string | null;
  font_size: number | null;
  bold: boolean | null;
  italic: boolean | null;
  underline: boolean | null;
  highlight: string | null;
  color: string | null;
}

interface PPTParagraph {
  text: string;
  runs: PPTRun[];
  level: number;
  bullet: boolean;
  bullet_char: string | false;
  alignment: string;
  color: string;
  placeholder_type: string | null;
}

interface PPTObject {
  name: string;
  type: string;
  typenum: number;
  position_emus: any;
  position: PPTPosition;
  rotation: number;
  text: string[];
  paragraph: PPTParagraph[];
  fill: { type: string; color?: string } | null;
  line: { color: string; width: number | null } | null;
  image?: string;
  video?: string;
  audio?: string;
  table?: any[][];
  crop?: any;
  flip_v?: boolean;
  flip_h?: boolean;
}

interface PPTBackground {
  type: string | null;
  color: string | null;
  image: string | null;
}

interface PPTSlide {
  slide_number: number;
  slide_layout: string;
  properties: {
    slide_id: number;
    width: number;
    height: number;
  };
  background: PPTBackground;
  objects: PPTObject[];
}

// Theme extracted from master slide
interface PPTTheme {
  colors: Record<string, string>;
  fonts: {
    major: string | null;
    minor: string | null;
  };
}



// Parser output structure (new format with theme)
interface ParserOutput {
  theme: PPTTheme;
  slides: PPTSlide[];
  spire_available: boolean;
}

// Types for our app format
interface AppElement {
  id: string;
  type: 'text' | 'heading' | 'image' | 'video' | 'shape';
  content: string;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  zIndex: number;
  imageUrl?: string;
  videoUrl?: string;
  shapeType?: string;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  rotation?: number;
}

interface AppSlide {
  id: string;
  elements: AppElement[];
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundGradient?: string;
}

interface TemplateInfo {
  id: string;
  name: string;
  originalFilename: string;
  slides: AppSlide[];
  slideCount: number;
  createdAt: string;
  thumbnails: string[];
  mediaFolder: string;
  presentationId?: string | undefined;
  theme?: PPTTheme | undefined; // Theme extracted from master slide
}

// Callback type for streaming progress
type StreamProgressCallback = (event: {
  type: 'init' | 'slide' | 'complete' | 'error';
  presentationId?: string | undefined;
  theme?: PPTTheme | undefined;
  totalSlides?: number | undefined;
  slideIndex?: number | undefined;
  slide?: AppSlide | undefined;
  error?: string | undefined;
}) => void;


class PPTConverterService {
  private pythonPath: string;
  private parserPath: string;
  private templatesDir: string;

  constructor() {
    // Use system Python with full path to avoid LibreOffice's Python
    // On Windows, use Laragon's Python or fallback to 'python'
    if (process.platform === 'win32') {
      // Try common Python installation paths
      const pythonPaths = [
        'D:/laragon/bin/python/python-3.10/python.exe',
        'C:/Python310/python.exe',
        'C:/Python39/python.exe',
        'C:/Users/' + (process.env['USERNAME'] || 'user') + '/AppData/Local/Programs/Python/Python310/python.exe',
        'python'
      ];

      this.pythonPath = pythonPaths.find(p => {
        try {
          if (p === 'python') return true;
          return fs.existsSync(p);
        } catch {
          return false;
        }
      }) || 'python';
    } else {
      this.pythonPath = 'python3';
    }

    this.parserPath = path.join(__dirname, '../python/pptx/parser.py');
    this.templatesDir = path.join(__dirname, '../../uploads/templates');

    console.log('[PPTConverter] Initialized with:');
    console.log('  Python path:', this.pythonPath);
    console.log('  Parser path:', this.parserPath);
    console.log('  Templates dir:', this.templatesDir);

    // Ensure templates directory exists
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
    }

    // Check if parser exists
    if (!fs.existsSync(this.parserPath)) {
      console.error('[PPTConverter] WARNING: Parser script not found at:', this.parserPath);
    }
  }

  /**
   * Parse a PPT file using the Python parser
   */
  async parsePPT(filePath: string, mediaFolder: string, selectedSlides?: number[]): Promise<PPTSlide[]> {
    return new Promise((resolve, reject) => {
      const slidesArg = selectedSlides ? selectedSlides.join(',') : '';

      console.log('[PPTConverter] Starting PPT parsing...');
      console.log('  File path:', filePath);
      console.log('  Media folder:', mediaFolder);
      console.log('  Selected slides:', slidesArg || 'all');

      // Build args array - spawn will handle quoting automatically
      const args = [
        this.parserPath,
        filePath,
        mediaFolder,
        slidesArg
      ];

      console.log('  Command:', this.pythonPath, args.map(a => `"${a}"`).join(' '));

      // Use spawn with shell: false (default) - it handles spaces in arguments correctly
      const pythonProcess = spawn(this.pythonPath, args, {
        // Use windowsVerbatimArguments on Windows to prevent argument mangling
        windowsVerbatimArguments: false,
        // Set working directory to avoid path issues
        cwd: path.dirname(this.parserPath)
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('[PPTConverter] Python stderr:', data.toString());
      });

      pythonProcess.on('error', (error) => {
        console.error('[PPTConverter] Failed to start Python process:', error);
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });

      pythonProcess.on('close', (code) => {
        console.log('[PPTConverter] Python process exited with code:', code);

        if (stderr) {
          console.error('[PPTConverter] Full stderr output:\n', stderr);
        }

        if (code !== 0) {
          console.error('[PPTConverter] Python parser failed!');
          console.error('  Exit code:', code);
          console.error('  Stderr:', stderr);
          console.error('  Stdout (first 500 chars):', stdout.substring(0, 500));
          reject(new Error(`Python parser failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Find the JSON object in the output (it now starts with '{' for the new format)
          let jsonStart = stdout.indexOf('{');
          let jsonEnd = stdout.lastIndexOf('}');

          // Fallback: check for old array format for backward compatibility
          const isNewFormat = jsonStart !== -1 && (stdout.indexOf('[') === -1 || jsonStart < stdout.indexOf('['));

          if (!isNewFormat) {
            jsonStart = stdout.indexOf('[');
            jsonEnd = stdout.lastIndexOf(']');
          }

          console.log('[PPTConverter] Parsing output...');
          console.log('  Total stdout length:', stdout.length);
          console.log('  JSON start index:', jsonStart);
          console.log('  JSON end index:', jsonEnd);
          console.log('  New format (with theme):', isNewFormat);

          if (jsonStart === -1 || jsonEnd === -1) {
            console.error('[PPTConverter] No valid JSON found in output');
            console.error('  Stdout (first 1000 chars):', stdout.substring(0, 1000));
            reject(new Error('No valid JSON output from parser'));
            return;
          }

          const jsonString = stdout.substring(jsonStart, jsonEnd + 1);
          const parsed = JSON.parse(jsonString);

          // Handle new format with theme data
          if (isNewFormat && parsed.slides) {
            const output = parsed as ParserOutput;
            console.log('[PPTConverter] Successfully parsed', output.slides.length, 'slides');
            console.log('[PPTConverter] Theme colors:', Object.keys(output.theme?.colors || {}).length);
            console.log('[PPTConverter] Spire available:', output.spire_available);
            // Store theme for later use
            (this as any)._lastParsedTheme = output.theme;
            resolve(output.slides);
          } else {
            // Legacy format: direct array of slides
            const slides = parsed as PPTSlide[];
            console.log('[PPTConverter] Successfully parsed', slides.length, 'slides (legacy format)');
            resolve(slides);
          }
        } catch (error) {
          console.error('[PPTConverter] Failed to parse JSON output:', error);
          console.error('  Stdout (first 1000 chars):', stdout.substring(0, 1000));
          reject(new Error(`Failed to parse JSON output: ${error}`));
        }
      });
    });
  }

  /**
   * Convert PPT paragraph runs to HTML content
   */
  private convertRunsToHTML(paragraph: PPTParagraph): string {
    if (!paragraph.runs || paragraph.runs.length === 0) {
      return paragraph.text || '';
    }

    let html = '';

    for (const run of paragraph.runs) {
      let text = run.text || '';

      // Apply formatting
      if (run.bold) {
        text = `<strong>${text}</strong>`;
      }
      if (run.italic) {
        text = `<em>${text}</em>`;
      }
      if (run.underline) {
        text = `<u>${text}</u>`;
      }

      // Apply color
      if (run.color && run.color !== 'No color' && run.color !== '000000') {
        const color = run.color.startsWith('#') ? run.color : `#${run.color}`;
        text = `<span style="color: ${color}">${text}</span>`;
      }

      // Apply font
      if (run.font_name || run.font_size) {
        let style = '';
        if (run.font_name) {
          style += `font-family: ${run.font_name};`;
        }
        if (run.font_size) {
          style += `font-size: ${run.font_size}px;`;
        }
        text = `<span style="${style}">${text}</span>`;
      }

      html += text;
    }

    return html;
  }

  /**
   * Convert PPT object to app element format
   */
  private convertObjectToElement(obj: PPTObject, index: number, baseUrl: string): AppElement | null {
    const id = `element-${uuidv4()}`;

    const baseElement = {
      id,
      position: {
        x: obj.position?.left || 0,
        y: obj.position?.top || 0,
      },
      size: {
        width: obj.position?.width || 200,
        height: obj.position?.height || 100,
      },
      zIndex: index + 1,
      rotation: obj.rotation || 0,
    };

    // Handle different object types
    if (obj.type === 'Picture' && obj.image) {
      return {
        ...baseElement,
        type: 'image',
        content: '',
        imageUrl: `${baseUrl}/${obj.image}`,
      };
    }

    if (obj.type === 'Video' && obj.video) {
      return {
        ...baseElement,
        type: 'video',
        content: '',
        videoUrl: `${baseUrl}/${obj.video}`,
      };
    }

    if (obj.type === 'Table' && obj.table) {
      // Convert table to HTML
      let tableHtml = '<table style="border-collapse: collapse; width: 100%;">';

      for (const row of obj.table) {
        tableHtml += '<tr>';
        for (const cell of row) {
          const bgcolor = cell.background_color ? `background-color: #${cell.background_color};` : '';
          const color = cell.font_color ? `color: #${cell.font_color};` : '';
          const fontSize = cell.font_size ? `font-size: ${cell.font_size}px;` : '';
          const fontWeight = cell.bold ? 'font-weight: bold;' : '';
          const fontStyle = cell.italic ? 'font-style: italic;' : '';

          const colspan = cell.colspan > 1 ? ` colspan="${cell.colspan}"` : '';
          const rowspan = cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : '';

          tableHtml += `<td${colspan}${rowspan} style="border: 1px solid #ccc; padding: 8px; ${bgcolor}${color}${fontSize}${fontWeight}${fontStyle}">${cell.text}</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</table>';

      return {
        ...baseElement,
        type: 'text',
        content: tableHtml,
      };
    }

    // Handle text/paragraph content
    if (obj.paragraph && obj.paragraph.length > 0) {
      let content = '';
      let isHeading = false;
      let headingLevel = 1;

      for (const para of obj.paragraph) {
        // Check if it's a title/heading placeholder
        if (para.placeholder_type && ['title', 'ctrTitle', 'subTitle'].includes(para.placeholder_type)) {
          isHeading = true;
          headingLevel = para.placeholder_type === 'subTitle' ? 2 : 1;
        }

        const paragraphContent = this.convertRunsToHTML(para);

        // Apply alignment
        const alignment = para.alignment || 'left';

        if (para.bullet && para.bullet_char) {
          content += `<li style="text-align: ${alignment}">${paragraphContent}</li>`;
        } else if (isHeading) {
          content += `<h${headingLevel} style="text-align: ${alignment}">${paragraphContent}</h${headingLevel}>`;
        } else {
          content += `<p style="text-align: ${alignment}">${paragraphContent}</p>`;
        }
      }

      // Wrap bullet points in ul
      if (content.includes('<li')) {
        content = `<ul>${content}</ul>`;
      }

      if (!content.trim()) {
        return null;
      }

      return {
        ...baseElement,
        type: isHeading ? 'heading' : 'text',
        content,
      };
    }

    // Handle shapes with fill
    if (obj.fill && obj.fill.type === 'solid' && obj.fill.color) {
      const shapeElement: AppElement = {
        ...baseElement,
        type: 'shape',
        content: '',
        shapeType: 'rectangle',
        fillColor: obj.fill.color.startsWith('#') ? obj.fill.color : `#${obj.fill.color}`,
      };

      if (obj.line?.color && obj.line.color !== 'No Line') {
        shapeElement.borderColor = obj.line.color.startsWith('#') ? obj.line.color : `#${obj.line.color}`;
      }
      if (obj.line?.width) {
        shapeElement.borderWidth = obj.line.width / 914400; // Convert EMU to pixels
      }

      return shapeElement;
    }

    return null;
  }

  /**
   * Convert PPT slide to app slide format
   */
  private convertSlideToAppFormat(pptSlide: PPTSlide, baseUrl: string): AppSlide {
    const slide: AppSlide = {
      id: `slide-${uuidv4()}`,
      elements: [],
    };

    // Handle background
    if (pptSlide.background) {
      if (pptSlide.background.type === 'solid' && pptSlide.background.color) {
        slide.backgroundColor = pptSlide.background.color.startsWith('#')
          ? pptSlide.background.color
          : `#${pptSlide.background.color}`;
      } else if (pptSlide.background.type === 'image' && pptSlide.background.image) {
        slide.backgroundImage = `${baseUrl}/${pptSlide.background.image}`;
      }
    }

    // Convert objects to elements
    for (let i = 0; i < pptSlide.objects.length; i++) {
      const obj = pptSlide.objects[i];
      if (!obj) continue;

      const element = this.convertObjectToElement(obj, i, baseUrl);

      if (element) {
        slide.elements.push(element);
      }
    }

    return slide;
  }

  /**
   * Process uploaded PPT file and convert to template
   */
  async processUploadedPPT(
    filePath: string,
    originalFilename: string,
    userId: string
  ): Promise<TemplateInfo> {
    console.log('[PPTConverter] Processing uploaded PPT...');
    console.log('  File path:', filePath);
    console.log('  Original filename:', originalFilename);
    console.log('  User ID:', userId);

    const templateId = uuidv4();
    const templateFolder = path.join(this.templatesDir, templateId);
    const mediaFolder = path.join(templateFolder, 'media');

    console.log('  Template ID:', templateId);
    console.log('  Template folder:', templateFolder);
    console.log('  Media folder:', mediaFolder);

    // Create template folder structure
    fs.mkdirSync(templateFolder, { recursive: true });
    fs.mkdirSync(mediaFolder, { recursive: true });

    // Copy the original PPT file
    const pptDestPath = path.join(templateFolder, 'original.pptx');
    fs.copyFileSync(filePath, pptDestPath);
    console.log('  Copied PPT to:', pptDestPath);

    try {
      // Parse the PPT file
      console.log('[PPTConverter] Calling Python parser...');
      const pptSlides = await this.parsePPT(filePath, mediaFolder);
      console.log('[PPTConverter] Python parser returned', pptSlides.length, 'slides');

      // Base URL for media files
      const baseUrl = `/uploads/templates/${templateId}/media`;

      // Convert slides to app format
      console.log('[PPTConverter] Converting slides to app format...');
      const appSlides: AppSlide[] = pptSlides.map((slide, index) => {
        console.log(`  Converting slide ${index + 1}...`);
        return this.convertSlideToAppFormat(slide, baseUrl);
      });
      console.log('[PPTConverter] Converted', appSlides.length, 'slides');

      // Generate thumbnails list (using layout images as thumbnails)
      const thumbnails = pptSlides.map(slide => {
        if (slide.background?.image) {
          return `${baseUrl}/${slide.background.image}`;
        }
        return null;
      }).filter(Boolean) as string[];
      console.log('[PPTConverter] Generated', thumbnails.length, 'thumbnails');

      // Save template as a presentation in the database
      let presentationId: string | undefined;
      try {
        const presentationName = path.basename(originalFilename, path.extname(originalFilename));

        // Convert appSlides to database format
        const dbSlides = appSlides.map((slide, index) => ({
          id: slide.id,
          title: `Slide ${index + 1}`,
          elements: slide.elements.map(el => ({
            id: el.id,
            type: el.type,
            content: el.content || '',
            position: {
              x: el.position.x,
              y: el.position.y
            },
            size: {
              width: el.size.width,
              height: el.size.height
            },
            zIndex: el.zIndex,
            rotation: el.rotation || 0,
            // Image specific fields
            imageUrl: el.imageUrl,
            // Video specific fields
            videoUrl: el.videoUrl,
            // Shape specific fields
            shapeType: el.shapeType,
            fillColor: el.fillColor,
            borderColor: el.borderColor,
            borderWidth: el.borderWidth
          })),
          backgroundColor: slide.backgroundColor || '#ffffff',
          backgroundImage: slide.backgroundImage,
          transition: 'slide',
          order: index
        }));

        const presentation = new Presentation({
          title: presentationName,
          description: `Imported from ${originalFilename}`,
          slides: dbSlides,
          theme: 'default',
          isPublic: false,
          tags: ['imported', 'template', 'ppt'],
          createdBy: userId !== 'anonymous' ? userId : undefined
        });

        // Only save if we have a valid userId
        if (userId && userId !== 'anonymous') {
          const savedPresentation = await presentation.save();
          presentationId = (savedPresentation._id as any).toString();
          console.log('[PPTConverter] Saved presentation to database with ID:', presentationId);
        } else {
          console.log('[PPTConverter] Skipping database save - no valid user ID');
        }
      } catch (dbError) {
        console.error('[PPTConverter] Failed to save presentation to database:', dbError);
        // Continue even if database save fails - we still have the file-based template
      }

      // Create template info
      const templateInfo: TemplateInfo = {
        id: templateId,
        name: path.basename(originalFilename, path.extname(originalFilename)),
        originalFilename,
        slides: appSlides,
        slideCount: appSlides.length,
        createdAt: new Date().toISOString(),
        thumbnails,
        mediaFolder: templateId,
        ...(presentationId && { presentationId })
      };

      // Save template info as JSON
      const infoPath = path.join(templateFolder, 'template.json');
      fs.writeFileSync(infoPath, JSON.stringify(templateInfo, null, 2));
      console.log('[PPTConverter] Saved template info to:', infoPath);

      console.log('[PPTConverter] Successfully processed PPT!');
      return templateInfo;
    } catch (error) {
      console.error('[PPTConverter] Error processing PPT:', error);
      // Clean up on error
      if (fs.existsSync(templateFolder)) {
        console.log('[PPTConverter] Cleaning up template folder...');
        fs.rmSync(templateFolder, { recursive: true, force: true });
      }
      throw error;
    }
  }

  /**
   * Process uploaded PPT file with per-slide progress
   * First gets slide count, then parses each slide individually
   * Emits progress events via callback after each slide is parsed
   */
  async processUploadedPPTStreaming(
    filePath: string,
    originalFilename: string,
    userId: string,
    onProgress: StreamProgressCallback
  ): Promise<TemplateInfo> {
    console.log('[PPTConverter] Processing uploaded PPT with per-slide parsing...');
    console.log('  File path:', filePath);
    console.log('  Original filename:', originalFilename);
    console.log('  User ID:', userId);

    const templateId = uuidv4();
    const templateFolder = path.join(this.templatesDir, templateId);
    const mediaFolder = path.join(templateFolder, 'media');

    console.log('  Template ID:', templateId);
    console.log('  Template folder:', templateFolder);
    console.log('  Media folder:', mediaFolder);

    // Create template folder structure
    fs.mkdirSync(templateFolder, { recursive: true });
    fs.mkdirSync(mediaFolder, { recursive: true });

    // Copy the original PPT file
    const pptDestPath = path.join(templateFolder, 'original.pptx');
    fs.copyFileSync(filePath, pptDestPath);
    console.log('  Copied PPT to:', pptDestPath);

    const baseUrl = `/uploads/templates/${templateId}/media`;

    try {
      // Step 1: Get slide count and theme using --count mode
      console.log('[PPTConverter] Getting slide count...');
      const countResult = await this.getSlideCount(filePath);
      const totalSlides = countResult.total_slides;
      const theme = countResult.theme;

      console.log(`[PPTConverter] Found ${totalSlides} slides`);

      // Emit init event
      onProgress({
        type: 'init',
        presentationId: templateId,
        theme,
        totalSlides
      });

      // Step 2: Parse FIRST slide only and return immediately
      const appSlides: AppSlide[] = [];

      console.log(`[PPTConverter] Parsing slide 1/${totalSlides} (initial)...`);
      try {
        const pptSlides = await this.parsePPT(filePath, mediaFolder, [1]);
        if (pptSlides.length > 0 && pptSlides[0]) {
          const appSlide = this.convertSlideToAppFormat(pptSlides[0], baseUrl);
          appSlides.push(appSlide);
          onProgress({
            type: 'slide',
            presentationId: templateId,
            slideIndex: 0,
            slide: appSlide
          });
        }
      } catch (slideError) {
        console.error(`[PPTConverter] Error parsing slide 1:`, slideError);
      }
      // Create initial template info with first slide, return immediately
      const initialTemplateInfo: TemplateInfo = {
        id: templateId,
        name: path.basename(originalFilename, path.extname(originalFilename)),
        originalFilename,
        slides: [...appSlides],
        slideCount: totalSlides, // Total expected
        createdAt: new Date().toISOString(),
        thumbnails: appSlides[0]?.backgroundImage ? [appSlides[0].backgroundImage] : [],
        mediaFolder: templateId,
        theme
      };

      // Save first slide to database immediately
      let dbPresentationId: string | undefined;
      if (appSlides.length > 0 && appSlides[0]) {
        dbPresentationId = await this.createPresentationWithFirstSlide(appSlides[0], originalFilename, userId);
        if (dbPresentationId) {
          initialTemplateInfo.presentationId = dbPresentationId;
        }
      }

      // Save initial template info
      const infoPath = path.join(templateFolder, 'template.json');
      fs.writeFileSync(infoPath, JSON.stringify(initialTemplateInfo, null, 2));

      // Step 3: Parse remaining slides in background
      if (totalSlides > 1) {
        this.parseRemainingSlides(
          filePath, mediaFolder, baseUrl, templateId, templateFolder,
          appSlides, totalSlides, theme, originalFilename, userId, onProgress,
          filePath, // Temp file path for cleanup
          dbPresentationId // DB presentation ID for incremental saving
        ).catch(err => {
          console.error('[PPTConverter] Background parsing error:', err);
          onProgress({ type: 'error', error: err.message });
        });
      } else {
        onProgress({ type: 'complete', presentationId: templateId });
        // Clean up temp file for single-slide case
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      console.log('[PPTConverter] Returning template with first slide');
      return initialTemplateInfo;
    } catch (error) {
      console.error('[PPTConverter] Error processing PPT:', error);
      onProgress({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });

      if (fs.existsSync(templateFolder)) {
        fs.rmSync(templateFolder, { recursive: true, force: true });
      }
      throw error;
    }
  }

  /**
   * Get slide count and theme from a PPT file using --count mode
   */
  private async getSlideCount(filePath: string): Promise<{ total_slides: number; theme: PPTTheme }> {
    return new Promise((resolve, reject) => {
      const args = [
        this.parserPath,
        filePath,
        '', // No media folder needed for count
        '', // No slide filter
        '--count'
      ];

      console.log('[PPTConverter] Getting slide count with --count mode...');

      const pythonProcess = spawn(this.pythonPath, args, {
        windowsVerbatimArguments: false,
        cwd: path.dirname(this.parserPath)
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        console.error('[PPTConverter] Count stderr:', data.toString());
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Count parser failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Find JSON in output
          const jsonStart = stdout.indexOf('{');
          const jsonEnd = stdout.lastIndexOf('}');
          if (jsonStart === -1 || jsonEnd === -1) {
            reject(new Error('No JSON found in count output'));
            return;
          }

          const jsonString = stdout.substring(jsonStart, jsonEnd + 1);
          const parsed = JSON.parse(jsonString);
          resolve({
            total_slides: parsed.total_slides,
            theme: parsed.theme
          });
        } catch (parseError) {
          reject(new Error(`Failed to parse count output: ${parseError}`));
        }
      });
    });
  }

  /**
   * Parse remaining slides in background after first slide is returned
   */
  private async parseRemainingSlides(
    filePath: string,
    mediaFolder: string,
    baseUrl: string,
    templateId: string,
    templateFolder: string,
    appSlides: AppSlide[],
    totalSlides: number,
    theme: PPTTheme | undefined,
    originalFilename: string,
    userId: string,
    onProgress: StreamProgressCallback,
    tempFilePath?: string, // Temp file to clean up when done
    dbPresentationId?: string // DB presentation ID for incremental saving
  ): Promise<void> {
    console.log(`[PPTConverter] Background parsing slides 2-${totalSlides}...`);

    for (let slideIndex = 2; slideIndex <= totalSlides; slideIndex++) {
      console.log(`[PPTConverter] Parsing slide ${slideIndex}/${totalSlides}...`);

      try {
        const pptSlides = await this.parsePPT(filePath, mediaFolder, [slideIndex]);

        if (pptSlides.length > 0 && pptSlides[0]) {
          const appSlide = this.convertSlideToAppFormat(pptSlides[0], baseUrl);
          appSlides.push(appSlide);

          // Save slide to database immediately
          if (dbPresentationId) {
            await this.addSlideToPresentation(dbPresentationId, appSlide, slideIndex - 1);
          }

          onProgress({
            type: 'slide',
            presentationId: templateId,
            slideIndex: slideIndex - 1,
            slide: appSlide
          });
        }
      } catch (slideError) {
        console.error(`[PPTConverter] Error parsing slide ${slideIndex}:`, slideError);
      }
    }

    onProgress({ type: 'complete', presentationId: templateId });

    // Update template.json with all slides
    const thumbnails = appSlides.map(s => s.backgroundImage).filter(Boolean) as string[];
    const finalInfo: TemplateInfo = {
      id: templateId,
      name: path.basename(originalFilename, path.extname(originalFilename)),
      originalFilename,
      slides: appSlides,
      slideCount: appSlides.length,
      createdAt: new Date().toISOString(),
      thumbnails,
      mediaFolder: templateId,
      theme
    };

    fs.writeFileSync(path.join(templateFolder, 'template.json'), JSON.stringify(finalInfo, null, 2));
    await this.saveTemplateToDatabase(appSlides, originalFilename, userId);

    // Clean up temp file after background parsing
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log('[PPTConverter] Cleaned up temp file:', tempFilePath);
    }

    console.log('[PPTConverter] Background parsing complete!');
  }

  /**
   * Create presentation in database with first slide
   * Returns the presentation ID for subsequent slide additions
   */
  private async createPresentationWithFirstSlide(
    firstSlide: AppSlide,
    originalFilename: string,
    userId: string
  ): Promise<string | undefined> {
    if (!userId || userId === 'anonymous') return undefined;

    try {
      const presentationName = path.basename(originalFilename, path.extname(originalFilename));

      const dbSlide = this.convertToDbSlide(firstSlide, 0);

      const presentation = new Presentation({
        title: presentationName,
        description: `Imported from ${originalFilename}`,
        slides: [dbSlide],
        theme: 'default',
        isPublic: false,
        tags: ['imported', 'template', 'ppt'],
        createdBy: userId
      });

      const savedPresentation = await presentation.save();
      const presentationId = (savedPresentation._id as any).toString();
      console.log('[PPTConverter] Created presentation with first slide, ID:', presentationId);
      return presentationId;
    } catch (dbError) {
      console.error('[PPTConverter] Failed to create presentation:', dbError);
      return undefined;
    }
  }

  /**
   * Add a single slide to an existing presentation in the database
   */
  private async addSlideToPresentation(
    presentationId: string,
    slide: AppSlide,
    slideIndex: number
  ): Promise<void> {
    if (!presentationId) return;

    try {
      const dbSlide = this.convertToDbSlide(slide, slideIndex);

      await Presentation.updateOne(
        { _id: presentationId },
        {
          $push: { slides: dbSlide },
          $set: { lastModified: new Date() }
        }
      );
      console.log(`[PPTConverter] Added slide ${slideIndex + 1} to presentation ${presentationId}`);
    } catch (dbError) {
      console.error(`[PPTConverter] Failed to add slide ${slideIndex + 1}:`, dbError);
    }
  }

  /**
   * Convert AppSlide to database slide format
   */
  private convertToDbSlide(slide: AppSlide, index: number) {
    return {
      id: slide.id,
      title: `Slide ${index + 1}`,
      elements: slide.elements.map(el => {
        // Build element with required fields
        const dbElement: any = {
          id: el.id,
          type: el.type,
          position: { x: el.position.x, y: el.position.y },
          size: { width: el.size.width, height: el.size.height },
          zIndex: el.zIndex,
          rotation: el.rotation || 0,
        };

        // Type-specific fields per validation schema
        if (el.type === 'text') {
          dbElement.content = el.content || '';
        } else if (el.type === 'heading') {
          dbElement.content = el.content || '';
          dbElement.level = 1; // Default to h1
        } else if (el.type === 'image') {
          dbElement.imageUrl = el.imageUrl || '';
        } else if (el.type === 'video') {
          dbElement.videoUrl = el.videoUrl || '';
        } else if (el.type === 'shape') {
          dbElement.shapeType = el.shapeType || 'rectangle';
          if (el.fillColor) dbElement.fillColor = el.fillColor;
          if (el.borderColor) dbElement.borderColor = el.borderColor;
          if (el.borderWidth) dbElement.borderWidth = el.borderWidth;
        }

        return dbElement;
      }),
      backgroundColor: slide.backgroundColor || '#ffffff',
      backgroundImage: slide.backgroundImage,
      transition: 'slide',
      order: index
    };
  }

  /**
   * Save all template slides to database (legacy method for batch save)
   */
  private async saveTemplateToDatabase(
    appSlides: AppSlide[],
    originalFilename: string,
    userId: string
  ): Promise<string | undefined> {
    if (!userId || userId === 'anonymous') return undefined;

    try {
      const presentationName = path.basename(originalFilename, path.extname(originalFilename));

      const dbSlides = appSlides.map((slide, index) => this.convertToDbSlide(slide, index));

      const presentation = new Presentation({
        title: presentationName,
        description: `Imported from ${originalFilename}`,
        slides: dbSlides,
        theme: 'default',
        isPublic: false,
        tags: ['imported', 'template', 'ppt'],
        createdBy: userId
      });

      const savedPresentation = await presentation.save();
      return (savedPresentation._id as any).toString();
    } catch (dbError) {
      console.error('[PPTConverter] Failed to save to database:', dbError);
    }
    return undefined;
  }

  /**
   * Get all templates
   */
  async getTemplates(): Promise<TemplateInfo[]> {
    const templates: TemplateInfo[] = [];

    if (!fs.existsSync(this.templatesDir)) {
      return templates;
    }

    const folders = fs.readdirSync(this.templatesDir);

    for (const folder of folders) {
      const templatePath = path.join(this.templatesDir, folder, 'template.json');

      if (fs.existsSync(templatePath)) {
        try {
          const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
          templates.push(templateData);
        } catch (error) {
          console.error(`Failed to read template ${folder}:`, error);
        }
      }
    }

    // Sort by creation date, newest first
    templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return templates;
  }

  /**
   * Get a specific template by ID
   */
  async getTemplate(templateId: string): Promise<TemplateInfo | null> {
    const templatePath = path.join(this.templatesDir, templateId, 'template.json');

    if (!fs.existsSync(templatePath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
    } catch (error) {
      console.error(`Failed to read template ${templateId}:`, error);
      return null;
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    const templateFolder = path.join(this.templatesDir, templateId);

    if (!fs.existsSync(templateFolder)) {
      return false;
    }

    try {
      // Try to get the template info to find the presentation ID
      const templatePath = path.join(templateFolder, 'template.json');
      if (fs.existsSync(templatePath)) {
        try {
          const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
          if (templateData.presentationId) {
            // Delete the presentation from the database
            await Presentation.findByIdAndDelete(templateData.presentationId);
            console.log('[PPTConverter] Deleted presentation from database:', templateData.presentationId);
          }
        } catch (readError) {
          console.error('[PPTConverter] Failed to read template for deletion:', readError);
        }
      }

      fs.rmSync(templateFolder, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.error(`Failed to delete template ${templateId}:`, error);
      return false;
    }
  }

  /**
   * Get a specific slide from a template
   * First tries to load from database (if presentationId exists), then falls back to template.json
   */
  async getTemplateSlide(templateId: string, slideIndex: number): Promise<AppSlide | null> {
    const template = await this.getTemplate(templateId);

    if (!template || slideIndex < 0) {
      return null;
    }

    // Try to load from database first (if presentationId exists)
    if (template.presentationId) {
      try {
        const presentation = await Presentation.findById(template.presentationId).lean() as any;
        if (presentation && presentation.slides && slideIndex < presentation.slides.length) {
          const dbSlide = presentation.slides[slideIndex];
          if (dbSlide) {
            console.log(`[PPTConverter] Loaded slide ${slideIndex} from database`);
            return {
              id: `slide-${uuidv4()}`,
              elements: (dbSlide.elements || []).map((element: any) => ({
                ...element,
                id: `element-${uuidv4()}`,
              })),
              backgroundColor: dbSlide.backgroundColor,
              backgroundImage: dbSlide.backgroundImage,
            };
          }
        }
      } catch (dbError) {
        console.error('[PPTConverter] Error loading slide from database:', dbError);
        // Fall through to file-based loading
      }
    }

    // Fallback to template.json file
    if (slideIndex >= template.slides.length) {
      return null;
    }

    const slide = template.slides[slideIndex];
    if (!slide) {
      return null;
    }
    console.log(`[PPTConverter] Loaded slide ${slideIndex} from template.json`);
    return {
      ...slide,
      id: `slide-${uuidv4()}`,
      elements: (slide.elements || []).map(element => ({
        ...element,
        id: `element-${uuidv4()}`,
      })),
    };
  }
}

export const pptConverterService = new PPTConverterService();
export default pptConverterService;

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Presentation from '../models/Presentation';
import { thumbnailService } from './ThumbnailService';

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
  letter_spacing: number | null;
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
  space_before?: number | null;
  space_after?: number | null;
  line_spacing?: string | null;
  indent?: number | null;
}

// Chart payload emitted by the python parser (matches ChartElement schema
// modulo id/position/size which are added at element-creation time).
interface PPTChartPayload {
  chartType: 'bar' | 'line' | 'pie' | 'area';
  data: {
    categories: string[];
    series: Array<{
      id: string;
      label: string;
      values: Array<number | null>;
      color?: string;
    }>;
  };
  stacked?: boolean;
  donut?: boolean;
  title?: string;
}

interface PPTObject {
  name: string;
  type: string;
  typenum: number;
  auto_shape_type?: number;
  preset_geometry?: string;
  corner_radius?: { tl: number; tr: number; br: number; bl: number };
  nvspr_id?: number;
  position_emus: any;
  position: PPTPosition;
  rotation: number;
  text: string[];
  paragraph: PPTParagraph[];
  fill: { type: string; color?: string; stops?: { color: string; position: number }[]; angle?: number } | null;
  line: { color: string; width: number | null; dash?: 'solid' | 'dashed' | 'dotted' } | null;
  image?: string;
  video?: string;
  audio?: string;
  table?: any[][];
  chart?: PPTChartPayload;
  crop?: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  flip_v?: boolean;
  flip_h?: boolean;
  text_anchor?: 'top' | 'middle' | 'bottom';
  padding_left?: number;
  padding_top?: number;
  padding_right?: number;
  padding_bottom?: number;
}

interface PPTBackground {
  type: string | null;
  color: string | null;
  image: string | null;
}

interface PPTAnimation {
  spid: number;
  preset_class: string;
  preset_id: number;
  preset_subtype: number;
  node_type: string;
  dur_ms: number | null;
  delay_ms: number;
  click_group: number;
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
  animations?: PPTAnimation[];
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
  type: 'text' | 'heading' | 'image' | 'video' | 'shape' | 'chart';
  content?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
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
  // Image crop
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  originalWidth?: number;
  originalHeight?: number;
  // Image flip
  flipX?: boolean;
  flipY?: boolean;
  objectFit?: string;
  opacity?: number;
  // Text layout
  verticalAlign?: 'top' | 'middle' | 'bottom';
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  // Shape gradient
  gradient?: {
    type: 'linear' | 'radial';
    angle?: number;
    stops: Array<{ position: number; color: string }>;
  };
  // Shape geometry
  cornerRadii?: { tl: number; tr: number; br: number; bl: number };
  borderDash?: 'solid' | 'dashed' | 'dotted';
  // Chart fields (when type === 'chart')
  chartType?: 'bar' | 'line' | 'pie' | 'area';
  data?: {
    categories: string[];
    series: Array<{
      id: string;
      label: string;
      values: Array<number | null>;
      color?: string;
    }>;
  };
  stacked?: boolean;
  donut?: boolean;
  showLegend?: boolean;
  legendPosition?: 'top' | 'right' | 'bottom';
  showAxis?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  title?: string;
}

interface AppSlide {
  id: string;
  elements: AppElement[];
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundGradient?: string;
  thumbnailUrl?: string;
  animations?: PPTAnimation[];
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
  thumbnailUrl?: string | undefined;
  error?: string | undefined;
}) => void;


class PPTConverterService {
  private pythonPath: string;
  private parserPath: string;
  private presentationsDir: string;

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
    this.presentationsDir = path.join(__dirname, '../../uploads/presentations');

    console.log('[PPTConverter] Initialized with:');
    console.log('  Python path:', this.pythonPath);
    console.log('  Parser path:', this.parserPath);
    console.log('  Presentations dir:', this.presentationsDir);

    // Ensure presentations directory exists
    if (!fs.existsSync(this.presentationsDir)) {
      fs.mkdirSync(this.presentationsDir, { recursive: true });
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
   * Map preset_geometry string (new parser) or typenum (legacy) to app shapeType.
   * preset_geometry takes priority — it is more precise than the typenum enum.
   */
  private resolveShapeType(obj: PPTObject): string {
    if (obj.preset_geometry) {
      const PRESET: Record<string, string> = {
        rect: 'rectangle',
        roundRect: 'rectangle',
        round1Rect: 'rectangle',
        round2SameRect: 'rectangle',
        round2DiagRect: 'rectangle',
        snipRoundRect: 'rectangle',
        ellipse: 'ellipse',
        oval: 'ellipse',
        triangle: 'triangle',
        rtTriangle: 'triangle',
        diamond: 'diamond',
        parallelogram: 'parallelogram',
        trapezoid: 'trapezoid',
        pentagon: 'pentagon',
        hexagon: 'hexagon',
        heptagon: 'pentagon',
        octagon: 'hexagon',
        decagon: 'hexagon',
        dodecagon: 'hexagon',
        star4: 'star',
        star5: 'star',
        star6: 'star',
        star7: 'star',
        star8: 'star',
        star10: 'star',
        star12: 'star',
        star16: 'star',
        star24: 'star',
        star32: 'star',
        rightArrow: 'arrow',
        leftArrow: 'arrow',
        upArrow: 'arrow',
        downArrow: 'arrow',
        leftRightArrow: 'arrow',
        upDownArrow: 'arrow',
        quadArrow: 'arrow',
        chevron: 'arrow',
        heart: 'heart',
        cloud: 'cloud',
        cloudCallout: 'cloud',
        line: 'line',
        straightConnector1: 'line',
        blockArc: 'ellipse',
        arc: 'ellipse',
        donut: 'ellipse',
      };
      return PRESET[obj.preset_geometry] ?? 'rectangle';
    }
    // Legacy numeric fallback
    const NUM: Record<number, string> = {
      1:  'rectangle',
      2:  'parallelogram',
      4:  'diamond',
      5:  'triangle',
      7:  'callout',
      9:  'ellipse',
      11: 'hexagon',
      12: 'pentagon',
      13: 'hexagon',
      16: 'star',
      17: 'star',
      18: 'star',
      32: 'arrow',
      33: 'arrow',
      38: 'heart',
      58: 'cloud',
    };
    return (obj.auto_shape_type !== undefined && NUM[obj.auto_shape_type])
      ? (NUM[obj.auto_shape_type] as string)
      : 'rectangle';
  }

  /**
   * Parse a hex color string that may be 6-digit RRGGBB or 8-digit RRGGBBAA.
   * Returns { color: '#RRGGBB', opacity?: number }.
   */
  private parseHexColor(hex: string): { color: string; opacity?: number } {
    const raw = hex.startsWith('#') ? hex.slice(1) : hex;
    if (raw.length === 8) {
      const alpha = parseInt(raw.slice(6, 8), 16) / 255;
      return {
        color: `#${raw.slice(0, 6).toUpperCase()}`,
        opacity: Math.round(alpha * 100) / 100,
      };
    }
    return { color: `#${raw.toUpperCase()}` };
  }

  /**
   * Convert a single PPT run to a styled <span> element.
   * Merges ALL styles into one span to prevent nested-span overrides.
   */
  private convertRunToSpan(run: PPTRun): string {
    const text = run.text || '';
    if (!text) return '';

    const styles: string[] = [];
    const decorations: string[] = [];

    if (run.font_name) {
      styles.push(`font-family: '${run.font_name}', sans-serif`);
    }
    if (run.font_size) {
      styles.push(`font-size: ${run.font_size}px`);
    }
    if (run.bold) {
      styles.push('font-weight: bold');
    }
    if (run.italic) {
      styles.push('font-style: italic');
    }
    if (run.underline) {
      decorations.push('underline');
    }
    if (run.color && run.color !== 'No color') {
      const c = run.color.startsWith('#') ? run.color : `#${run.color}`;
      styles.push(`color: ${c}`);
    }
    if (run.letter_spacing != null) {
      styles.push(`letter-spacing: ${run.letter_spacing}px`);
    }
    if (decorations.length) {
      styles.push(`text-decoration: ${decorations.join(' ')}`);
    }

    if (!styles.length) {
      return text;
    }
    return `<span style="${styles.join('; ')}">${text}</span>`;
  }

  /**
   * Convert PPT paragraph runs to HTML content
   */
  private convertRunsToHTML(paragraph: PPTParagraph): string {
    if (!paragraph.runs || paragraph.runs.length === 0) {
      return paragraph.text || '';
    }
    return paragraph.runs.map(r => this.convertRunToSpan(r)).join('');
  }

  /**
   * Convert PPT object to app element format
   */
  private convertObjectToElement(obj: PPTObject, index: number, baseUrl: string): AppElement | AppElement[] | null {
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

    // Chart — emitted by the python parser as type === 'Chart' with a
    // structured `chart` payload. Falls into a ChartElement directly; the
    // client picks up auto-themed series colors from extracted document
    // colors when no explicit series.color is set.
    if (obj.type === 'Chart' && obj.chart) {
      const chartElement: AppElement = {
        ...baseElement,
        type: 'chart',
        chartType: obj.chart.chartType,
        data: obj.chart.data,
      };
      if (obj.chart.stacked) chartElement.stacked = true;
      if (obj.chart.donut) chartElement.donut = true;
      if (obj.chart.title) chartElement.title = obj.chart.title;
      return chartElement;
    }

    // Handle different object types
    if (obj.type === 'Picture' && obj.image) {
      const imgElement: AppElement = {
        ...baseElement,
        type: 'image',
        imageUrl: `${baseUrl}/${obj.image}`,
        flipX: obj.flip_h || false,
        flipY: obj.flip_v || false,
      };
      // Map crop data (2D)
      if (obj.crop) {
        const c = obj.crop;
        const totalW = c.width || 1;
        const totalH = c.height || 1;
        imgElement.cropX    = Math.round((c.left  / totalW) * 100);
        imgElement.cropY    = Math.round((c.top   / totalH) * 100);
        imgElement.cropWidth  = Math.round(((totalW - c.left - c.right)  / totalW) * 100);
        imgElement.cropHeight = Math.round(((totalH - c.top  - c.bottom) / totalH) * 100);
        imgElement.originalWidth  = totalW;
        imgElement.originalHeight = totalH;
      }
      return imgElement;
    }

    if (obj.type === 'Video' && obj.video) {
      return {
        ...baseElement,
        type: 'video',
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
    const elements: AppElement[] = [];

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

        // Build paragraph-level style (2B)
        const paraStyles: string[] = [];
        const alignment = para.alignment || 'left';
        paraStyles.push(`text-align: ${alignment}`);
        if (para.space_before != null) paraStyles.push(`margin-top: ${para.space_before}px`);
        if (para.space_after  != null) paraStyles.push(`margin-bottom: ${para.space_after}px`);
        if (para.line_spacing != null) paraStyles.push(`line-height: ${para.line_spacing}`);
        if (para.indent != null)       paraStyles.push(`margin-left: ${para.indent}px`);
        const paraStyle = paraStyles.length ? ` style="${paraStyles.join('; ')}"` : '';

        if (para.bullet && para.bullet_char) {
          content += `<li${paraStyle}>${paragraphContent}</li>`;
        } else if (isHeading) {
          content += `<h${headingLevel}${paraStyle}>${paragraphContent}</h${headingLevel}>`;
        } else {
          content += `<p${paraStyle}>${paragraphContent}</p>`;
        }
      }

      // Wrap bullet points in ul
      if (content.includes('<li')) {
        content = `<ul>${content}</ul>`;
      }

      if (content.trim()) {
        const textEl: AppElement = {
          ...baseElement,
          id: `${id}-text`, // Ensure unique ID if we also add a shape
          type: isHeading ? 'heading' : 'text',
          content,
          zIndex: baseElement.zIndex + 1, // Place text above shape
        };
        // Heading elements MUST carry a level field — Joi validation
        // forbids saving a heading without one. headingLevel is computed
        // above from the placeholder type (title=1, subTitle=2).
        if (isHeading) {
          textEl.level = headingLevel as 1 | 2 | 3 | 4 | 5 | 6;
        }
        // Map vertical alignment and padding (2G)
        if (obj.text_anchor) textEl.verticalAlign = obj.text_anchor;
        if (obj.padding_left   != null) textEl.paddingLeft   = obj.padding_left;
        if (obj.padding_top    != null) textEl.paddingTop    = obj.padding_top;
        if (obj.padding_right  != null) textEl.paddingRight  = obj.padding_right;
        if (obj.padding_bottom != null) textEl.paddingBottom = obj.padding_bottom;
        elements.push(textEl);
      }
    }

    const hasSolidFill = obj.fill && obj.fill.type === 'solid' && obj.fill.color;
    const hasGradientFill = obj.fill && obj.fill.type === 'gradient' && obj.fill.stops && obj.fill.stops.length > 0;
    const hasLine = obj.line && obj.line.color && obj.line.color !== 'No Line';

    const isBasicShape = obj.typenum === 1 || hasSolidFill || hasGradientFill || hasLine;

    if (isBasicShape) {
      const shapeElement: AppElement = {
        ...baseElement,
        type: 'shape',
        shapeType: this.resolveShapeType(obj),
      };

      if (hasSolidFill) {
        const parsed = this.parseHexColor(obj.fill!.color as string);
        shapeElement.fillColor = parsed.color;
        if (parsed.opacity !== undefined && parsed.opacity < 1) {
          shapeElement.opacity = parsed.opacity;
        }
      } else if (hasGradientFill) {
        const firstStop = obj.fill!.stops![0]?.color || '888888';
        const parsed = this.parseHexColor(firstStop);
        shapeElement.fillColor = parsed.color;
        shapeElement.gradient = {
          type: 'linear',
          angle: obj.fill!.angle || 0,
          stops: obj.fill!.stops!.map(s => {
            const sp = this.parseHexColor(s.color as string);
            return { position: s.position, color: sp.color };
          }),
        };
      } else {
        shapeElement.fillColor = 'transparent';
      }

      if (hasLine) {
        const lc = obj.line!.color;
        shapeElement.borderColor = lc.startsWith('#') ? lc : `#${lc}`;
        if (obj.line!.width) {
          shapeElement.borderWidth = Math.round(obj.line!.width / 12700 * (96 / 72));
        } else {
          shapeElement.borderWidth = 1;
        }
        if (obj.line!.dash && obj.line!.dash !== 'solid') {
          shapeElement.borderDash = obj.line!.dash;
        }
      } else {
        shapeElement.borderColor = 'transparent';
        shapeElement.borderWidth = 0;
      }

      if (obj.corner_radius) {
        shapeElement.cornerRadii = obj.corner_radius;
      }

      if (hasSolidFill || hasGradientFill || hasLine || elements.length === 0) {
        elements.push(shapeElement);
      }
    }

    if (elements.length > 0) {
      return elements;
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
        if (Array.isArray(element)) {
          slide.elements.push(...element);
        } else {
          slide.elements.push(element);
        }
      }
    }

    // Preserve slide-level animation timeline from the parser
    if (pptSlide.animations && pptSlide.animations.length > 0) {
      slide.animations = pptSlide.animations;
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
    const templateFolder = path.join(this.presentationsDir, templateId);
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
      const baseUrl = `/uploads/presentations/${templateId}/media`;

      // Convert slides to app format
      console.log('[PPTConverter] Converting slides to app format...');
      const appSlides: AppSlide[] = pptSlides.map((slide, index) => {
        console.log(`  Converting slide ${index + 1}...`);
        return this.convertSlideToAppFormat(slide, baseUrl);
      });
      console.log('[PPTConverter] Converted', appSlides.length, 'slides');

      // Generate thumbnails using ThumbnailService
      console.log('[PPTConverter] Generating thumbnails...');
      const thumbnails: string[] = [];
      for (let i = 0; i < appSlides.length; i++) {
        const slide = appSlides[i];
        if (slide) {
          try {
            const thumbnailUrl = await thumbnailService.renderSlideThumbnail(
              templateId,
              i,
              {
                id: slide.id,
                elements: slide.elements,
                backgroundColor: slide.backgroundColor,
                backgroundImage: slide.backgroundImage
              }
            );
            thumbnails.push(thumbnailUrl);
          } catch (thumbError) {
            console.error(`[PPTConverter] Failed to generate thumbnail for slide ${i + 1}:`, thumbError);
          }
        }
      }
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
          thumbnailUrl: thumbnails[index], // Include thumbnail URL in slide data
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

      console.log('[PPTConverter] Template data saved to MongoDB');

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
    const templateFolder = path.join(this.presentationsDir, templateId);
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

    const baseUrl = `/uploads/presentations/${templateId}/media`;

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
      let firstThumbnail: string | undefined;
      try {
        const pptSlides = await this.parsePPT(filePath, mediaFolder, [1]);
        if (pptSlides.length > 0 && pptSlides[0]) {
          const appSlide = this.convertSlideToAppFormat(pptSlides[0], baseUrl);
          appSlides.push(appSlide);

          // Generate thumbnail for first slide before emitting progress
          try {
            firstThumbnail = await thumbnailService.renderSlideThumbnail(
              templateId,
              0,
              {
                id: appSlide.id,
                elements: appSlide.elements,
                backgroundColor: appSlide.backgroundColor,
                backgroundImage: appSlide.backgroundImage
              }
            );
            console.log(`[PPTConverter] Generated thumbnail for slide 1: ${firstThumbnail}`);
          } catch (thumbError) {
            console.error('[PPTConverter] Failed to generate first slide thumbnail:', thumbError);
          }

          onProgress({
            type: 'slide',
            presentationId: templateId,
            slideIndex: 0,
            slide: appSlide,
            thumbnailUrl: firstThumbnail
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
        thumbnails: firstThumbnail ? [firstThumbnail] : [],
        mediaFolder: templateId,
        theme
      };

      // Save first slide to database immediately
      let dbPresentationId: string | undefined;
      if (appSlides.length > 0 && appSlides[0]) {
        dbPresentationId = await this.createPresentationWithFirstSlide(appSlides[0], originalFilename, userId, firstThumbnail);
        if (dbPresentationId) {
          initialTemplateInfo.presentationId = dbPresentationId;
        }
      }

      // Template data is saved to MongoDB via createPresentationWithFirstSlide
      console.log('[PPTConverter] Initial template data saved to MongoDB');

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
    _templateFolder: string,
    appSlides: AppSlide[],
    totalSlides: number,
    _theme: PPTTheme | undefined,
    _originalFilename: string,
    _userId: string,
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

          // Generate thumbnail for this slide
          let thumbnailUrl: string | undefined;
          try {
            thumbnailUrl = await thumbnailService.renderSlideThumbnail(
              templateId,
              slideIndex - 1,
              {
                id: appSlide.id,
                elements: appSlide.elements,
                backgroundColor: appSlide.backgroundColor,
                backgroundImage: appSlide.backgroundImage
              }
            );
            console.log(`[PPTConverter] Generated thumbnail for slide ${slideIndex}: ${thumbnailUrl}`);
          } catch (thumbError) {
            console.error(`[PPTConverter] Failed to generate thumbnail for slide ${slideIndex}:`, thumbError);
          }

          // Save slide to database immediately
          if (dbPresentationId) {
            await this.addSlideToPresentation(dbPresentationId, appSlide, slideIndex - 1, thumbnailUrl);
          }

          // update thumbnailUrl in appSlide
          if (thumbnailUrl) {
            appSlide.thumbnailUrl = thumbnailUrl;
          }

          onProgress({
            type: 'slide',
            presentationId: dbPresentationId || templateId,
            slideIndex: slideIndex - 1,
            slide: appSlide,
            thumbnailUrl
          });
        }
      } catch (slideError) {
        console.error(`[PPTConverter] Error parsing slide ${slideIndex}:`, slideError);
      }
    }

    onProgress({ type: 'complete', presentationId: templateId });

    // All slides are already saved to MongoDB incrementally via addSlideToPresentation
    console.log('[PPTConverter] All slides saved to MongoDB');

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
    userId: string,
    thumbnailUrl?: string
  ): Promise<string | undefined> {
    if (!userId || userId === 'anonymous') return undefined;

    try {
      const presentationName = path.basename(originalFilename, path.extname(originalFilename));

      const dbSlide = this.convertToDbSlide(firstSlide, 0, thumbnailUrl);

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

  private async addSlideToPresentation(
    presentationId: string,
    slide: AppSlide,
    slideIndex: number,
    thumbnailUrl?: string
  ): Promise<void> {
    if (!presentationId) return;

    try {
      const dbSlide = this.convertToDbSlide(slide, slideIndex, thumbnailUrl);

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
  private convertToDbSlide(slide: AppSlide, index: number, thumbnailUrl?: string) {
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
        } else if (el.type === 'chart') {
          dbElement.chartType = el.chartType || 'bar';
          dbElement.data = el.data || { categories: [], series: [] };
          if (el.stacked) dbElement.stacked = true;
          if (el.donut) dbElement.donut = true;
          if (el.title) dbElement.title = el.title;
          if (el.legendPosition) dbElement.legendPosition = el.legendPosition;
          if (el.showLegend !== undefined) dbElement.showLegend = el.showLegend;
          if (el.showAxis !== undefined) dbElement.showAxis = el.showAxis;
          if (el.showGrid !== undefined) dbElement.showGrid = el.showGrid;
          if (el.showLabels !== undefined) dbElement.showLabels = el.showLabels;
        }

        return dbElement;
      }),
      backgroundColor: slide.backgroundColor || '#ffffff',
      backgroundImage: slide.backgroundImage,
      thumbnailUrl, // Include thumbnail URL in slide data
      transition: 'slide',
      order: index
    };
  }


  /**
   * Get all templates
   */
  async getTemplates(): Promise<TemplateInfo[]> {
    try {
      const presentations = await Presentation.find({ tags: 'template' })
        .sort({ createdAt: -1 })
        .lean() as any[];

      return presentations.map(p => ({
        id: p._id.toString(),
        presentationId: p._id.toString(),
        name: p.title,
        originalFilename: `${p.title}.pptx`,
        slides: (p.slides || []).map((s: any) => ({
          id: s.id,
          elements: s.elements || [],
          backgroundColor: s.backgroundColor,
          backgroundImage: s.backgroundImage,
        })),
        slideCount: p.slides?.length || 0,
        createdAt: p.createdAt?.toISOString() || new Date().toISOString(),
        thumbnails: (p.slides || []).map((s: any) => s.thumbnailUrl).filter(Boolean),
        mediaFolder: p._id.toString(),
      }));
    } catch (error) {
      console.error('[PPTConverter] Failed to get templates from database:', error);
      return [];
    }
  }

  /**
   * Get a specific template by ID
   */
  async getTemplate(templateId: string): Promise<TemplateInfo | null> {
    try {
      const presentation = await Presentation.findById(templateId).lean() as any;
      if (!presentation) return null;

      return {
        id: presentation._id.toString(),
        presentationId: presentation._id.toString(),
        name: presentation.title,
        originalFilename: `${presentation.title}.pptx`,
        slides: (presentation.slides || []).map((s: any) => ({
          id: s.id,
          elements: s.elements || [],
          backgroundColor: s.backgroundColor,
          backgroundImage: s.backgroundImage,
        })),
        slideCount: presentation.slides?.length || 0,
        createdAt: presentation.createdAt?.toISOString() || new Date().toISOString(),
        thumbnails: (presentation.slides || []).map((s: any) => s.thumbnailUrl).filter(Boolean),
        mediaFolder: presentation._id.toString(),
      };
    } catch (error) {
      console.error(`[PPTConverter] Failed to read template ${templateId}:`, error);
      return null;
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const result = await Presentation.findByIdAndDelete(templateId);
      if (!result) {
        console.log(`[PPTConverter] Template ${templateId} not found in database`);
        return false;
      }

      console.log('[PPTConverter] Deleted template from database:', templateId);

      // Also delete media folder if it exists
      const templateFolder = path.join(this.presentationsDir, templateId);
      if (fs.existsSync(templateFolder)) {
        fs.rmSync(templateFolder, { recursive: true, force: true });
        console.log('[PPTConverter] Deleted template media folder:', templateFolder);
      }

      return true;
    } catch (error) {
      console.error(`[PPTConverter] Failed to delete template ${templateId}:`, error);
      return false;
    }
  }

  /**
   * Get a specific slide from a template
   * First tries to load from database (if presentationId exists), then falls back to template.json
   */
  async getTemplateSlide(templateId: string, slideIndex: number): Promise<AppSlide | null> {
    if (slideIndex < 0) return null;

    try {
      const presentation = await Presentation.findById(templateId).lean() as any;
      if (!presentation || !presentation.slides || slideIndex >= presentation.slides.length) {
        return null;
      }

      const dbSlide = presentation.slides[slideIndex];
      if (!dbSlide) return null;

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
    } catch (error) {
      console.error(`[PPTConverter] Error loading slide ${slideIndex} from database:`, error);
      return null;
    }
  }
}

export const pptConverterService = new PPTConverterService();
export default pptConverterService;

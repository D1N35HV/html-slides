// Chart series colors are derived from the deck's existing palette so a chart
// inserted into a branded deck looks coherent without user configuration. When
// a series has an explicit `color`, that wins; otherwise the series color is
// indexed deterministically into the document palette so re-renders stay
// stable and two charts on the same slide don't fight for the same hue.
//
// The fallback palette below kicks in when the deck has no extracted colors
// yet (a brand-new presentation). Lead hue is the locked PRODUCT.md
// ink-indigo accent; the rest are tuned to harmonize against the warm-tinted
// paper neutrals in the .lp-root token system — saturated enough to read at
// small sizes, calm enough to recede behind imported slide content.

import { extractDocumentColors } from './documentColors';
import type { Slide, ChartSeries } from '../store/sliceTypes';

const FALLBACK_PALETTE: readonly string[] = [
  'oklch(0.38 0.15 265)',  // ink-indigo (locked accent)
  'oklch(0.55 0.13 50)',   // amber
  'oklch(0.50 0.12 155)',  // forest
  'oklch(0.55 0.13 220)',  // sky
  'oklch(0.45 0.13 320)',  // plum
  'oklch(0.55 0.13 95)',   // chartreuse
  'oklch(0.45 0.10 25)',   // brick
  'oklch(0.50 0.11 195)',  // teal
];

export function paletteFromDocColors(docColors: readonly string[]): string[] {
  if (!docColors || docColors.length === 0) return [...FALLBACK_PALETTE];
  // Doc colors first (so brand colors win), then fallback fills the tail when
  // there aren't enough deck colors for the series count. Dedupe by lowercase
  // string so identical colors from different sources collapse.
  const seen = new Set<string>();
  const combined: string[] = [];
  for (const c of [...docColors, ...FALLBACK_PALETTE]) {
    const k = c.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      combined.push(c);
    }
  }
  return combined;
}

export function paletteFromSlides(slides: readonly Slide[]): string[] {
  return paletteFromDocColors(extractDocumentColors(slides as Slide[]));
}

export function resolveSeriesColor(
  series: Pick<ChartSeries, 'color'>,
  seriesIndex: number,
  palette: readonly string[],
): string {
  if (series.color) return series.color;
  if (palette.length === 0) return FALLBACK_PALETTE[0];
  return palette[seriesIndex % palette.length];
}

// Slide background → axis/tick/legend text color. Naive luminance check on
// hex; oklch backgrounds and 'transparent' fall through to the dark default
// (slides default to a paper-light background, so dark text is the safe bet).
export function deriveTextColor(slideBg: string | undefined): string {
  const dark = 'oklch(0.2 0.025 265)';   // --ink
  const light = 'oklch(0.96 0.005 80)';  // near-paper
  if (!slideBg || slideBg === 'transparent') return dark;
  const hex = slideBg.trim().toLowerCase();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(hex);
  if (!m) return dark;
  const h = m[1].length === 3
    ? m[1].split('').map(c => c + c).join('')
    : m[1];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Rec. 709 luminance, normalized 0–1.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? dark : light;
}

// Realistic per-type sample data used both for picker mini-previews and the
// initial state of an inserted chart. Q7 of the design brief: "Realistic
// per-type defaults" — comparison story for bar, trend story for line,
// composition for area, share for pie. Editors land on a chart that already
// looks coherent, then edit values rather than starting from a blank grid.
import type { ChartType, ChartData } from '../store/sliceTypes';

export const DEFAULT_CHART_DATA: Record<ChartType, ChartData> = {
  bar: {
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [
      { id: 's1', label: 'Revenue', values: [400, 520, 610, 680] },
      { id: 's2', label: 'Cost',    values: [240, 300, 340, 380] },
    ],
  },
  line: {
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    series: [
      { id: 's1', label: 'Users', values: [120, 180, 260, 330, 420, 510] },
    ],
  },
  area: {
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    series: [
      { id: 's1', label: 'Mobile',  values: [40, 60, 90, 120, 160, 200] },
      { id: 's2', label: 'Desktop', values: [80, 90, 110, 140, 170, 200] },
    ],
  },
  pie: {
    categories: ['Product A', 'Product B', 'Product C', 'Product D'],
    series: [
      { id: 's1', label: 'Share', values: [42, 28, 18, 12] },
    ],
  },
};

export function defaultChartElementProps(chartType: ChartType): {
  chartType: ChartType;
  data: ChartData;
  stacked?: boolean;
  donut?: boolean;
  showLegend: boolean;
  legendPosition: 'top' | 'right' | 'bottom';
  showAxis: boolean;
  showGrid: boolean;
  showLabels: boolean;
} {
  return {
    chartType,
    data: cloneChartData(DEFAULT_CHART_DATA[chartType]),
    // Area defaults to stacked because the sample data is a composition story;
    // bar defaults to grouped since the sample is a comparison story.
    stacked: chartType === 'area' ? true : undefined,
    donut: undefined,
    showLegend: true,
    legendPosition: 'bottom',
    showAxis: true,
    showGrid: true,
    showLabels: false,
  };
}

function cloneChartData(d: ChartData): ChartData {
  return {
    categories: [...d.categories],
    series: d.series.map(s => ({ ...s, values: [...s.values] })),
  };
}

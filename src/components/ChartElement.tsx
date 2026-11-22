import React from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList,
} from 'recharts';
import { useStore } from '../store/index';
import { useShallow } from 'zustand/react/shallow';
import {
  paletteFromSlides,
  paletteFromDocColors,
  resolveSeriesColor,
  deriveTextColor,
} from '../utils/chartPalette';
import type {
  ChartData,
  ChartType,
  ChartLegendPosition,
} from '../store/sliceTypes';

// Inheritance from .lp-root tokens isn't available here — slides render
// outside the editor chrome's CSS scope. Mirror the locked PRODUCT.md values
// so chart text stays brand-consistent regardless of where it lives.
const FONT_FAMILY = '"Mona Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const GRID_HAIR = 'oklch(0.84 0.018 80 / 0.55)';   // --rule-strong @ low alpha
const TICK_INK = 'oklch(0.42 0.02 265)';            // --ink-muted

interface ChartElementProps {
  elementId: string;
  chartType: ChartType;
  data: ChartData;
  primarySeriesId?: string;
  stacked?: boolean;
  donut?: boolean;
  showLegend?: boolean;
  legendPosition?: ChartLegendPosition;
  showAxis?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  title?: string;
  textColor?: string;
  mode?: 'edit' | 'present';
  /** Compressed render for picker tiles: no axis/grid/legend/labels, no animation, no tooltip. */
  preview?: boolean;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

// Recharts wants wide rows: one row per category, one numeric key per series.
// Storage uses parallel arrays (Q4: parallel arrays survive series renames
// without re-keying every row), so this conversion happens at render time.
function toWideRows(data: ChartData): Array<Record<string, number | null | string>> {
  return data.categories.map((cat, i) => {
    const row: Record<string, number | null | string> = { __category: cat };
    for (const s of data.series) {
      row[s.id] = s.values[i] ?? null;
    }
    return row;
  });
}

// Pie reads one series. Negative values are dropped to zero for v1 — pie
// can't represent negative shares, and the design-brief decision (Q10) is to
// flag this in a soft inline notice, not silently distort.
function toPieRows(
  data: ChartData,
  primarySeriesId: string | undefined,
): Array<{ name: string; value: number; index: number }> {
  const series = primarySeriesId
    ? (data.series.find(s => s.id === primarySeriesId) ?? data.series[0])
    : data.series[0];
  if (!series) return [];
  return data.categories.map((cat, i) => ({
    name: cat,
    value: Math.max(0, series.values[i] ?? 0),
    index: i,
  }));
}

function legendVerticalAlign(pos: ChartLegendPosition): 'top' | 'middle' | 'bottom' {
  if (pos === 'top') return 'top';
  if (pos === 'right') return 'middle';
  return 'bottom';
}

function legendAlign(pos: ChartLegendPosition): 'left' | 'center' | 'right' {
  return pos === 'right' ? 'right' : 'center';
}

function legendLayout(pos: ChartLegendPosition): 'horizontal' | 'vertical' {
  return pos === 'right' ? 'vertical' : 'horizontal';
}

export function ChartElement(props: ChartElementProps) {
  const {
    chartType,
    data,
    primarySeriesId,
    stacked = false,
    donut = false,
    showLegend = true,
    legendPosition = 'bottom',
    showAxis = true,
    showGrid = true,
    showLabels = false,
    title,
    textColor,
    mode = 'edit',
    preview = false,
  } = props;

  // Preview tiles render the same chart at small size in the picker — they
  // must look identical regardless of which deck is open, so they bypass the
  // slide-derived palette and text-color machinery entirely. Hooks still
  // need to be called unconditionally, so we read empty values in preview
  // mode rather than skipping the call.
  const slides = useStore(useShallow((s) => preview ? [] : s.slides));
  const currentSlide = useStore((s) => s.currentSlide);
  const slideBg = preview ? undefined : slides[currentSlide]?.backgroundColor;

  const palette = React.useMemo(
    () => preview ? paletteFromDocColors([]) : paletteFromSlides(slides),
    [preview, slides],
  );

  const reducedMotion = usePrefersReducedMotion();
  // Editor: never animate (would flicker on every cell edit, and thumbnail
  // rasterization needs a settled frame). Viewer: animate unless user opted
  // out via prefers-reduced-motion. Preview tiles: never animate.
  const isAnimationActive = !preview && mode === 'present' && !reducedMotion;

  const resolvedTextColor = textColor ?? (preview ? TICK_INK : deriveTextColor(slideBg));

  // Preview mode strips all chrome down to the data shape — what users
  // actually need to recognize the chart type at tile size.
  const _showAxis = preview ? false : showAxis;
  const _showGrid = preview ? false : showGrid;
  const _showLegend = preview ? false : showLegend;
  const _showLabels = preview ? false : showLabels;
  const _title = preview ? undefined : title;
  const _tooltip = !preview && mode === 'present';

  // Chart container margins. Recharts needs explicit margins so axis labels
  // don't clip; tighter margins in preview to maximize the visible data area.
  const chartMargin = preview
    ? { top: 4, right: 4, bottom: 4, left: 4 }
    : { top: 8, right: 16, bottom: 8, left: 8 };

  // Defensive read — orphan chart elements (type='chart' but no data, e.g.
  // from a partially-completed PPTX import predating the chart-aware
  // converter) reach the renderer with `data` undefined. Render empty
  // instead of crashing the React tree; the save-time heal will drop them.
  const seriesColors = React.useMemo(
    () => (data?.series ?? []).map((s, i) => resolveSeriesColor(s, i, palette)),
    [data?.series, palette],
  );

  if (!chartType || !data || !data.series || !data.categories) {
    return (
      <div
        style={{ width: '100%', height: '100%' }}
        aria-label="Chart placeholder (data missing)"
      />
    );
  }

  const tickStyle = {
    fill: resolvedTextColor === TICK_INK ? TICK_INK : resolvedTextColor,
    fontSize: preview ? 8 : 11,
    fontFamily: FONT_FAMILY,
  };

  const legendWrapperStyle: React.CSSProperties = {
    fontSize: 11,
    fontFamily: FONT_FAMILY,
    color: resolvedTextColor,
    paddingTop: legendPosition === 'top' ? 0 : 6,
    paddingBottom: legendPosition === 'bottom' ? 0 : 6,
  };

  const tooltipContentStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    border: '1px solid oklch(0.84 0.018 80)',
    borderRadius: 0, // sharp corners — PRODUCT.md "precision instrument"
    background: 'oklch(1 0 0)',
    color: 'oklch(0.2 0.025 265)',
    boxShadow: '0 8px 24px oklch(0.2 0.025 265 / 0.08)',
  };

  // Build the chart body. Each branch returns a single recharts root so
  // <ResponsiveContainer> can mount it.
  let chartBody: React.ReactElement;
  switch (chartType) {
    case 'bar': {
      const rows = toWideRows(data);
      chartBody = (
        <BarChart data={rows} margin={chartMargin}>
          {_showGrid && <CartesianGrid stroke={GRID_HAIR} strokeDasharray="2 4" vertical={false} />}
          {_showAxis && (
            <XAxis
              dataKey="__category"
              stroke={GRID_HAIR}
              tick={tickStyle as any}
              tickLine={false}
              axisLine={{ stroke: GRID_HAIR }}
              interval="preserveStartEnd"
            />
          )}
          {_showAxis && (
            <YAxis
              stroke={GRID_HAIR}
              tick={tickStyle as any}
              tickLine={false}
              axisLine={{ stroke: GRID_HAIR }}
              width={36}
            />
          )}
          {_tooltip && <Tooltip contentStyle={tooltipContentStyle} cursor={{ fill: 'oklch(0.2 0.025 265 / 0.04)' }} />}
          {_showLegend && (
            <Legend
              verticalAlign={legendVerticalAlign(legendPosition)}
              align={legendAlign(legendPosition)}
              layout={legendLayout(legendPosition)}
              wrapperStyle={legendWrapperStyle}
              iconType="square"
              iconSize={10}
            />
          )}
          {data.series.map((s, i) => (
            <Bar
              key={s.id}
              dataKey={s.id}
              name={s.label}
              fill={seriesColors[i]}
              stackId={stacked ? 'stack' : undefined}
              isAnimationActive={isAnimationActive}
              animationDuration={700}
              animationEasing="ease-out"
              radius={preview ? 0 : [2, 2, 0, 0]}
            >
              {_showLabels && (
                <LabelList
                  dataKey={s.id}
                  position="top"
                  style={{ fill: resolvedTextColor, fontSize: 10, fontFamily: FONT_FAMILY }}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      );
      break;
    }

    case 'line': {
      const rows = toWideRows(data);
      chartBody = (
        <LineChart data={rows} margin={chartMargin}>
          {_showGrid && <CartesianGrid stroke={GRID_HAIR} strokeDasharray="2 4" vertical={false} />}
          {_showAxis && (
            <XAxis
              dataKey="__category"
              stroke={GRID_HAIR}
              tick={tickStyle as any}
              tickLine={false}
              axisLine={{ stroke: GRID_HAIR }}
              interval="preserveStartEnd"
            />
          )}
          {_showAxis && (
            <YAxis
              stroke={GRID_HAIR}
              tick={tickStyle as any}
              tickLine={false}
              axisLine={{ stroke: GRID_HAIR }}
              width={36}
            />
          )}
          {_tooltip && <Tooltip contentStyle={tooltipContentStyle} />}
          {_showLegend && (
            <Legend
              verticalAlign={legendVerticalAlign(legendPosition)}
              align={legendAlign(legendPosition)}
              layout={legendLayout(legendPosition)}
              wrapperStyle={legendWrapperStyle}
              iconType="line"
              iconSize={14}
            />
          )}
          {data.series.map((s, i) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.label}
              stroke={seriesColors[i]}
              strokeWidth={preview ? 1.5 : 2}
              dot={preview ? false : { r: 2.5, strokeWidth: 1, fill: seriesColors[i] }}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={isAnimationActive}
              animationDuration={700}
              animationEasing="ease-out"
            >
              {_showLabels && (
                <LabelList
                  dataKey={s.id}
                  position="top"
                  style={{ fill: resolvedTextColor, fontSize: 10, fontFamily: FONT_FAMILY }}
                />
              )}
            </Line>
          ))}
        </LineChart>
      );
      break;
    }

    case 'area': {
      const rows = toWideRows(data);
      chartBody = (
        <AreaChart data={rows} margin={chartMargin}>
          {_showGrid && <CartesianGrid stroke={GRID_HAIR} strokeDasharray="2 4" vertical={false} />}
          {_showAxis && (
            <XAxis
              dataKey="__category"
              stroke={GRID_HAIR}
              tick={tickStyle as any}
              tickLine={false}
              axisLine={{ stroke: GRID_HAIR }}
              interval="preserveStartEnd"
            />
          )}
          {_showAxis && (
            <YAxis
              stroke={GRID_HAIR}
              tick={tickStyle as any}
              tickLine={false}
              axisLine={{ stroke: GRID_HAIR }}
              width={36}
            />
          )}
          {_tooltip && <Tooltip contentStyle={tooltipContentStyle} />}
          {_showLegend && (
            <Legend
              verticalAlign={legendVerticalAlign(legendPosition)}
              align={legendAlign(legendPosition)}
              layout={legendLayout(legendPosition)}
              wrapperStyle={legendWrapperStyle}
              iconType="square"
              iconSize={10}
            />
          )}
          {data.series.map((s, i) => (
            <Area
              key={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.label}
              stroke={seriesColors[i]}
              strokeWidth={preview ? 1 : 1.5}
              fill={seriesColors[i]}
              fillOpacity={stacked ? 0.85 : 0.35}
              stackId={stacked ? 'stack' : undefined}
              connectNulls={false}
              isAnimationActive={isAnimationActive}
              animationDuration={700}
              animationEasing="ease-out"
            />
          ))}
        </AreaChart>
      );
      break;
    }

    case 'pie': {
      const rows = toPieRows(data, primarySeriesId);
      // Pie auto-centers in its container regardless of aspect ratio. Inner
      // radius non-zero = donut. Outer radius keeps a small margin so labels
      // (when shown) have room.
      const outerR = preview ? '85%' : '78%';
      const innerR = donut ? (preview ? '45%' : '46%') : 0;
      chartBody = (
        <PieChart margin={chartMargin}>
          {_tooltip && <Tooltip contentStyle={tooltipContentStyle} />}
          {_showLegend && (
            <Legend
              verticalAlign={legendVerticalAlign(legendPosition)}
              align={legendAlign(legendPosition)}
              layout={legendLayout(legendPosition)}
              wrapperStyle={legendWrapperStyle}
              iconType="square"
              iconSize={10}
            />
          )}
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={outerR as unknown as number}
            innerRadius={innerR as unknown as number}
            isAnimationActive={isAnimationActive}
            animationDuration={700}
            animationEasing="ease-out"
            paddingAngle={donut ? 1 : 0}
            stroke="oklch(1 0 0)"
            strokeWidth={1}
            label={_showLabels ? (entry: any) => `${entry.value}` : undefined}
            labelLine={_showLabels}
          >
            {rows.map((row, i) => (
              <Cell key={row.index} fill={palette[i % palette.length]} />
            ))}
          </Pie>
        </PieChart>
      );
      break;
    }

    default: {
      const exhaustive: never = chartType;
      void exhaustive;
      chartBody = <div />;
      break;
    }
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT_FAMILY,
        color: resolvedTextColor,
        // Edit mode: clicks fall through to the wrapping
        // ResizableDraggableElement so the user can select/drag/resize.
        // Preview tiles: clicks fall through to the wrapping picker button.
        // Present mode: tooltips need pointer capture, so events are live.
        pointerEvents: preview || mode === 'edit' ? 'none' : 'auto',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {_title && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'center',
            padding: '6px 8px 2px',
            color: resolvedTextColor,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}
        >
          {_title}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartBody}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

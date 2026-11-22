import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/index';
import { useShallow } from 'zustand/react/shallow';
import toast from 'react-hot-toast';
import { ColorPicker } from './ui/ColorPicker';
import { extractDocumentColors } from '../utils/documentColors';
import { paletteFromDocColors, resolveSeriesColor } from '../utils/chartPalette';
import { parseChartCell, parseClipboardPaste } from '../utils/parseChartCell';
import { useDebouncedCommit, useThrottledCallback } from '../utils/chartThrottle';
import type {
  ChartType,
  ChartLegendPosition,
  ChartSeries,
  ChartData,
} from '../store/sliceTypes';
import {
  XMarkIcon,
  PlusIcon,
  ClipboardDocumentIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const CHART_TYPES: ReadonlyArray<{ id: ChartType; label: string }> = [
  { id: 'bar',  label: 'Bar' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'pie',  label: 'Pie' },
];

const LEGEND_POSITIONS: ReadonlyArray<{ id: ChartLegendPosition; label: string }> = [
  { id: 'top',    label: 'Top' },
  { id: 'right',  label: 'Right' },
  { id: 'bottom', label: 'Bottom' },
];

interface ChartEditorPanelProps {
  elementId: string;
}

export function ChartEditorPanel({ elementId }: ChartEditorPanelProps) {
  const updateChartElement = useStore((s) => s.updateChartElement);
  const slides = useStore(useShallow((s) => s.slides));
  const currentSlide = useStore((s) => s.currentSlide);
  const docColors = useMemo(() => extractDocumentColors(slides), [slides]);
  const palette = useMemo(() => paletteFromDocColors(docColors), [docColors]);

  const slide = slides[currentSlide];
  const element = slide?.elements.find(e => e.id === elementId);

  if (!element || element.type !== 'chart') {
    return (
      <section className="es-section">
        <div className="es-empty">
          <div className="es-empty-title">Chart not found</div>
          <div className="es-empty-body">The selected chart is no longer on this slide.</div>
        </div>
      </section>
    );
  }

  // Orphan chart guard — same root cause as the ChartElement crash. A
  // chart-typed element without chartType/data slipped in via an earlier
  // PPTX import (chart-aware parser + converter weren't both deployed).
  // The save-time heal will drop these on the next save; until then,
  // render a recoverable empty state so the user isn't stuck.
  if (!element.chartType || !element.data || !element.data.series || !element.data.categories) {
    return (
      <section className="es-section">
        <div className="es-empty">
          <div className="es-empty-title">Empty chart placeholder</div>
          <div className="es-empty-body">
            This chart is missing its data — likely an orphan from an earlier
            import. It will be cleaned up automatically on your next save.
            You can also delete it now (Backspace) and re-add a chart from
            the Charts panel.
          </div>
        </div>
      </section>
    );
  }

  const chart = element;

  // ─── Type swap (Q10: preserve all data) ───────────────────────────
  const onSwapType = (next: ChartType) => {
    if (next === chart.chartType) return;
    updateChartElement(elementId, { chartType: next });
  };

  // ─── Pie disambiguation (Q10) ─────────────────────────────────────
  const isPie = chart.chartType === 'pie';
  const showPieNotice = isPie && chart.data.series.length > 1;
  const activePieSeries = useMemo(() => {
    if (!isPie || chart.data.series.length === 0) return null;
    if (chart.primarySeriesId) {
      const found = chart.data.series.find(s => s.id === chart.primarySeriesId);
      if (found) return found;
    }
    return chart.data.series[0];
  }, [chart.data.series, chart.primarySeriesId, isPie]);

  const onPickPrimarySeries = (seriesId: string) => {
    updateChartElement(elementId, { primarySeriesId: seriesId });
  };

  // ─── Cell editing ─────────────────────────────────────────────────
  const [rejectedCells, setRejectedCells] = useState<Set<string>>(new Set());

  const cellKey = (rowIndex: number, seriesId: string) => `${rowIndex}:${seriesId}`;

  const commitCell = (seriesId: string, rowIndex: number, raw: string) => {
    const parsed = parseChartCell(raw);
    if (parsed.kind === 'reject') {
      setRejectedCells(prev => {
        const next = new Set(prev);
        next.add(cellKey(rowIndex, seriesId));
        return next;
      });
      return;
    }
    setRejectedCells(prev => {
      if (!prev.has(cellKey(rowIndex, seriesId))) return prev;
      const next = new Set(prev);
      next.delete(cellKey(rowIndex, seriesId));
      return next;
    });
    const newValue = parsed.kind === 'gap' ? null : parsed.value;
    const newSeries = chart.data.series.map(s =>
      s.id === seriesId
        ? { ...s, values: s.values.map((v, i) => i === rowIndex ? newValue : v) }
        : s
    );
    updateChartElement(elementId, {
      data: { ...chart.data, series: newSeries },
    });
  };

  const commitCategory = (rowIndex: number, raw: string) => {
    const newCats = chart.data.categories.slice();
    newCats[rowIndex] = raw.trim() || newCats[rowIndex];
    updateChartElement(elementId, {
      data: { ...chart.data, categories: newCats },
    });
  };

  const commitSeriesLabel = (seriesId: string, raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) return;
    const newSeries = chart.data.series.map(s =>
      s.id === seriesId ? { ...s, label: cleaned } : s
    );
    updateChartElement(elementId, {
      data: { ...chart.data, series: newSeries },
    });
  };

  const commitSeriesColorImmediate = (seriesId: string, color: string | undefined) => {
    const newSeries = chart.data.series.map(s =>
      s.id === seriesId ? { ...s, color } : s
    );
    updateChartElement(elementId, {
      data: { ...chart.data, series: newSeries },
    });
  };
  // Color sliders fire onChange ~60Hz during drag. Throttle to 60ms with
  // a trailing emit so the user's final color always lands while
  // collaborators still see live preview during the drag (Q15).
  const commitSeriesColor = useThrottledCallback(commitSeriesColorImmediate, 60);

  const addRow = () => {
    const newCats = [...chart.data.categories, `Row ${chart.data.categories.length + 1}`];
    const newSeries = chart.data.series.map(s => ({
      ...s,
      values: [...s.values, null],
    }));
    updateChartElement(elementId, {
      data: { categories: newCats, series: newSeries },
    });
  };

  const removeRow = (rowIndex: number) => {
    if (chart.data.categories.length <= 1) {
      toast.error('Charts need at least one row');
      return;
    }
    const newCats = chart.data.categories.filter((_, i) => i !== rowIndex);
    const newSeries = chart.data.series.map(s => ({
      ...s,
      values: s.values.filter((_, i) => i !== rowIndex),
    }));
    updateChartElement(elementId, {
      data: { categories: newCats, series: newSeries },
    });
  };

  const addSeries = () => {
    const newId = `s${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next: ChartSeries = {
      id: newId,
      label: `Series ${chart.data.series.length + 1}`,
      values: chart.data.categories.map(() => null),
    };
    updateChartElement(elementId, {
      data: { ...chart.data, series: [...chart.data.series, next] },
    });
  };

  const removeSeries = (seriesId: string) => {
    if (chart.data.series.length <= 1) {
      toast.error('Charts need at least one series');
      return;
    }
    const newSeries = chart.data.series.filter(s => s.id !== seriesId);
    const updates: any = { data: { ...chart.data, series: newSeries } };
    if (chart.primarySeriesId === seriesId) updates.primarySeriesId = undefined;
    updateChartElement(elementId, updates);
  };

  // ─── Paste (Q13: HTML-table-first, then TSV/CSV; replaces all data) ──
  const applyPaste = (html: string | null, plain: string) => {
    const parsed = parseClipboardPaste(html, plain);
    if (!parsed || parsed.rows.length === 0) {
      toast.error("Couldn't parse the pasted data");
      return;
    }
    let dataRows = parsed.rows;
    let seriesLabels: string[] | null = null;
    if (parsed.hasHeader) {
      seriesLabels = dataRows[0].slice(1);
      dataRows = dataRows.slice(1);
    }
    if (dataRows.length === 0 || dataRows[0].length < 2) {
      toast.error('Pasted data needs a category column plus at least one value column');
      return;
    }
    const newCategories = dataRows.map(r => (r[0] || '').trim() || ' ');
    const seriesCount = dataRows[0].length - 1;
    const newSeries: ChartSeries[] = [];
    const stamp = Date.now();
    for (let s = 0; s < seriesCount; s++) {
      const id = `s${stamp}-${s}`;
      const label = seriesLabels?.[s]?.trim() || `Series ${s + 1}`;
      const values: Array<number | null> = dataRows.map(r => {
        const cell = parseChartCell(r[s + 1] ?? '');
        return cell.kind === 'value' ? cell.value : null;
      });
      newSeries.push({ id, label, values });
    }
    updateChartElement(elementId, {
      data: { categories: newCategories, series: newSeries },
    });
    setRejectedCells(new Set());
    toast.success(
      `Imported ${newCategories.length} ${newCategories.length === 1 ? 'row' : 'rows'} × ${seriesCount} ${seriesCount === 1 ? 'series' : 'series'}`
    );
  };

  const onGridPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Cell-level paste (text into a focused input) is handled by the browser.
    // Grid-level paste (focus on grid container, not a cell) replaces all.
    const target = e.target as HTMLElement;
    const insideCell = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    if (insideCell) return;
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    applyPaste(html || null, plain);
  };

  // Fallback "Paste data" textarea — for when the user has data not on the
  // clipboard, or auto-detect mis-detected and they want to retry explicitly.
  const [pasteFallbackOpen, setPasteFallbackOpen] = useState(false);
  const [pasteFallbackText, setPasteFallbackText] = useState('');

  // ─── Style toggles & inputs ───────────────────────────────────────
  const setStyle = (updates: Partial<typeof chart>) => updateChartElement(elementId, updates);

  // ─── Series color expansion ───────────────────────────────────────
  const [openColorSeries, setOpenColorSeries] = useState<string | null>(null);

  const showStackToggle = chart.chartType === 'bar' || chart.chartType === 'area';
  const showDonutToggle = chart.chartType === 'pie';

  return (
    <section className="es-section" onPaste={onGridPaste}>
      {/* ── Type swap ── */}
      <div>
        <div className="es-section-title"><span>Chart type</span></div>
        <Segmented
          options={CHART_TYPES}
          value={chart.chartType}
          onChange={onSwapType}
        />
      </div>

      {/* ── Pie disambiguation (Q10) ── */}
      {showPieNotice && activePieSeries && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '10px 12px',
            background: 'var(--accent-wash)',
            border: '1px solid color-mix(in oklch, var(--accent-ink) 18%, transparent)',
            color: 'var(--ink)',
            fontSize: 12.5,
            lineHeight: 1.45,
          }}
        >
          <ExclamationTriangleIcon style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1, color: 'var(--accent-ink)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>
              Pie shows one series. Currently slicing <strong>{activePieSeries.label}</strong>.
            </div>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {chart.data.series.map((s, i) => {
                const selected = s.id === activePieSeries.id;
                const swatch = resolveSeriesColor(s, i, palette);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onPickPrimarySeries(s.id)}
                    aria-pressed={selected}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 8px',
                      fontSize: 11.5,
                      background: selected ? 'var(--paper-elev)' : 'transparent',
                      border: `1px solid ${selected ? 'var(--accent-ink)' : 'color-mix(in oklch, var(--accent-ink) 22%, transparent)'}`,
                      color: 'var(--ink)',
                      cursor: 'pointer',
                      borderRadius: 0,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        background: swatch,
                        flexShrink: 0,
                      }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Data grid ── */}
      <div>
        <div className="es-section-title"><span>Data</span></div>
        <div
          style={{
            border: '1px solid var(--rule-hair)',
            background: 'var(--paper-elev)',
            overflowX: 'auto',
          }}
        >
          {/* Series header row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `minmax(96px, 1.1fr) repeat(${chart.data.series.length}, minmax(96px, 1fr)) 28px`,
              borderBottom: '1px solid var(--rule-hair)',
              background: 'var(--paper-sunk)',
            }}
          >
            <div
              style={{
                padding: '8px 10px',
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ink-faint)',
                borderRight: '1px solid var(--rule-hair)',
              }}
            >
              Category
            </div>
            {chart.data.series.map((s, i) => {
              const swatch = resolveSeriesColor(s, i, palette);
              const isOpen = openColorSeries === s.id;
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 8px',
                    borderRight: '1px solid var(--rule-hair)',
                  }}
                >
                  <button
                    type="button"
                    aria-label={`Change ${s.label} color`}
                    onClick={() => setOpenColorSeries(isOpen ? null : s.id)}
                    style={{
                      width: 12,
                      height: 12,
                      flexShrink: 0,
                      background: swatch,
                      border: `1px solid ${s.color ? 'var(--ink)' : 'var(--rule-strong)'}`,
                      cursor: 'pointer',
                      padding: 0,
                      borderRadius: 0,
                    }}
                  />
                  <CellInput
                    initialValue={s.label}
                    onCommit={(text) => commitSeriesLabel(s.id, text)}
                    placeholder={`Series ${i + 1}`}
                    ariaLabel={`Series ${i + 1} label`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--ink)',
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${s.label}`}
                    onClick={() => removeSeries(s.id)}
                    className="es-icon-btn"
                    style={{ width: 18, height: 18, flexShrink: 0 }}
                    disabled={chart.data.series.length <= 1}
                  >
                    <XMarkIcon style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addSeries}
              aria-label="Add series"
              title="Add series"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--ink-faint)',
              }}
            >
              <PlusIcon style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* Inline color picker for the open series. Tucks under the
              series header row so the spatial relationship stays clear. */}
          {openColorSeries && (() => {
            const s = chart.data.series.find(x => x.id === openColorSeries);
            if (!s) return null;
            return (
              <div
                style={{
                  padding: '10px 12px',
                  background: 'var(--paper)',
                  borderBottom: '1px solid var(--rule-hair)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-faint)',
                    }}
                  >
                    {s.label} color
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenColorSeries(null)}
                    aria-label="Close color picker"
                    className="es-icon-btn"
                    style={{ width: 20, height: 20 }}
                  >
                    <XMarkIcon style={{ width: 12, height: 12 }} />
                  </button>
                </div>
                <ColorPicker
                  value={s.color}
                  onChange={(c) => commitSeriesColor(s.id, c)}
                  onClear={() => commitSeriesColor(s.id, undefined)}
                  documentColors={docColors}
                  clearLabel="Auto from palette"
                />
              </div>
            );
          })()}

          {/* Data rows */}
          {chart.data.categories.map((cat, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              style={{
                display: 'grid',
                gridTemplateColumns: `minmax(96px, 1.1fr) repeat(${chart.data.series.length}, minmax(96px, 1fr)) 28px`,
                borderBottom: rowIndex === chart.data.categories.length - 1 ? 'none' : '1px solid var(--rule-hair)',
              }}
            >
              <div
                style={{
                  padding: '6px 10px',
                  borderRight: '1px solid var(--rule-hair)',
                  background: 'var(--paper-sunk)',
                }}
              >
                <CellInput
                  initialValue={cat}
                  onCommit={(text) => commitCategory(rowIndex, text)}
                  ariaLabel={`Category ${rowIndex + 1}`}
                  style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}
                />
              </div>
              {chart.data.series.map((s) => {
                const v = s.values[rowIndex];
                const display = v === null || v === undefined ? '' : String(v);
                const rejected = rejectedCells.has(cellKey(rowIndex, s.id));
                return (
                  <div
                    key={s.id}
                    style={{
                      padding: '6px 8px',
                      borderRight: '1px solid var(--rule-hair)',
                      background: rejected ? 'oklch(0.97 0.04 27)' : undefined,
                    }}
                  >
                    <CellInput
                      initialValue={display}
                      onCommit={(text) => commitCell(s.id, rowIndex, text)}
                      ariaLabel={`${s.label} ${cat}`}
                      placeholder={rejected ? 'Invalid' : ''}
                      style={{
                        fontFamily: '"Courier Prime", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 12,
                        textAlign: 'right',
                        color: rejected ? 'oklch(0.42 0.14 27)' : 'var(--ink)',
                      }}
                    />
                  </div>
                );
              })}
              <button
                type="button"
                aria-label={`Remove row ${rowIndex + 1}`}
                onClick={() => removeRow(rowIndex)}
                disabled={chart.data.categories.length <= 1}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: chart.data.categories.length <= 1 ? 'not-allowed' : 'pointer',
                  opacity: chart.data.categories.length <= 1 ? 0.3 : 1,
                  color: 'var(--ink-faint)',
                }}
              >
                <XMarkIcon style={{ width: 12, height: 12 }} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={addRow}
            style={tinyButtonStyle}
          >
            <PlusIcon style={{ width: 12, height: 12 }} />
            Add row
          </button>
          <button
            type="button"
            onClick={() => setPasteFallbackOpen(v => !v)}
            style={{
              ...tinyButtonStyle,
              background: pasteFallbackOpen ? 'var(--accent-wash)' : 'var(--paper-elev)',
              borderColor: pasteFallbackOpen ? 'var(--accent-ink)' : 'var(--rule-strong)',
            }}
            aria-expanded={pasteFallbackOpen}
          >
            <ClipboardDocumentIcon style={{ width: 12, height: 12 }} />
            Paste data
          </button>
        </div>

        {pasteFallbackOpen && (
          <div style={{ marginTop: 8 }}>
            <textarea
              value={pasteFallbackText}
              onChange={(e) => setPasteFallbackText(e.target.value)}
              placeholder={`Paste TSV/CSV here. Headers row optional, e.g.:\n\nMonth\tRevenue\tCost\nJan\t400\t240\nFeb\t520\t300`}
              rows={6}
              style={{
                width: '100%',
                fontFamily: '"Courier Prime", ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 11.5,
                padding: 8,
                border: '1px solid var(--rule-strong)',
                background: 'var(--paper-elev)',
                color: 'var(--ink)',
                resize: 'vertical',
                outline: 'none',
                borderRadius: 0,
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => {
                  if (!pasteFallbackText.trim()) {
                    toast.error('Nothing to paste');
                    return;
                  }
                  applyPaste(null, pasteFallbackText);
                  setPasteFallbackOpen(false);
                  setPasteFallbackText('');
                }}
                style={{
                  ...tinyButtonStyle,
                  background: 'var(--accent-ink)',
                  color: 'var(--paper)',
                  borderColor: 'var(--accent-ink)',
                }}
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasteFallbackOpen(false);
                  setPasteFallbackText('');
                }}
                style={tinyButtonStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="es-meta" style={{ marginTop: 8, lineHeight: 1.5 }}>
          Tip: paste from a spreadsheet anywhere on the grid to replace data.
          Cells accept currency, percent, and SI suffixes (1.2K, 3M).
        </div>
      </div>

      {/* ── Style ── */}
      <div>
        <div className="es-section-title"><span>Style</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Title */}
          <FormRow label="Title">
            <CellInput
              initialValue={chart.title ?? ''}
              onCommit={(text) => setStyle({ title: text || undefined })}
              placeholder="Optional"
              ariaLabel="Chart title"
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 12.5,
                color: 'var(--ink)',
                background: 'var(--paper-elev)',
                border: '1px solid var(--rule-strong)',
              }}
            />
          </FormRow>

          {showStackToggle && (
            <ToggleRow
              label="Stacked"
              checked={!!chart.stacked}
              onChange={(v) => setStyle({ stacked: v || undefined })}
            />
          )}
          {showDonutToggle && (
            <ToggleRow
              label="Donut"
              checked={!!chart.donut}
              onChange={(v) => setStyle({ donut: v || undefined })}
            />
          )}

          <ToggleRow
            label="Legend"
            checked={chart.showLegend !== false}
            onChange={(v) => setStyle({ showLegend: v })}
          />
          {chart.showLegend !== false && (
            <FormRow label="Position">
              <Segmented
                options={LEGEND_POSITIONS}
                value={chart.legendPosition ?? 'bottom'}
                onChange={(v) => setStyle({ legendPosition: v })}
              />
            </FormRow>
          )}
          {!isPie && (
            <ToggleRow
              label="Axis"
              checked={chart.showAxis !== false}
              onChange={(v) => setStyle({ showAxis: v })}
            />
          )}
          {!isPie && (
            <ToggleRow
              label="Gridlines"
              checked={chart.showGrid !== false}
              onChange={(v) => setStyle({ showGrid: v })}
            />
          )}
          <ToggleRow
            label="Value labels"
            checked={!!chart.showLabels}
            onChange={(v) => setStyle({ showLabels: v })}
          />
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────
// Local primitives — kept in this file because they're only used by
// the chart editor and don't justify a separate ui/ entry yet.
// ──────────────────────────────────────────────────────────────────

interface CellInputProps {
  initialValue: string;
  onCommit: (text: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
}

function CellInput({ initialValue, onCommit, placeholder, ariaLabel, style }: CellInputProps) {
  const [value, setValue] = useState(initialValue);
  // External updates (paste, undo, remote collab patches) need to refresh
  // the input — but only when the user isn't actively editing, otherwise we
  // yank the cursor mid-keystroke.
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setValue(initialValue);
  }, [initialValue]);

  // Q15: typing fires intermediate commits every 200ms so collaborators see
  // partial state, blur/Enter flushes immediately so the final value lands
  // without waiting for the timer.
  const { schedule, flush, cancel } = useDebouncedCommit<string>(onCommit, 200);

  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => {
        const v = e.target.value;
        setValue(v);
        if (v !== initialValue) schedule(v);
      }}
      onFocus={() => { focusedRef.current = true; }}
      onBlur={() => {
        focusedRef.current = false;
        flush();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          flush();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          // Discard pending edit and revert to the canonical value.
          cancel();
          setValue(initialValue);
          (e.target as HTMLInputElement).blur();
        }
      }}
      style={{
        width: '100%',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        padding: 0,
        ...style,
      }}
    />
  );
}

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}

function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        border: '1px solid var(--rule-strong)',
        background: 'var(--paper-elev)',
      }}
    >
      {options.map((opt, i) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.id)}
            style={{
              padding: '7px 8px',
              fontSize: 12,
              fontWeight: selected ? 600 : 500,
              color: selected ? 'var(--paper)' : 'var(--ink)',
              background: selected ? 'var(--accent-ink)' : 'transparent',
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid var(--rule-strong)',
              cursor: 'pointer',
              transition: 'background 120ms ease-out, color 120ms ease-out',
              borderRadius: 0,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
}

function CheckmarkToggle({ checked, onChange, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      style={{
        width: 18,
        height: 18,
        flexShrink: 0,
        background: checked ? 'var(--accent-ink)' : 'var(--paper-elev)',
        border: `1px solid ${checked ? 'var(--accent-ink)' : 'var(--rule-strong)'}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        borderRadius: 0,
        transition: 'background 120ms ease-out',
      }}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2 6.5l2.5 2.5L10 3" stroke="var(--paper)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '76px 1fr', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{label}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '76px 1fr', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{label}</span>
      <CheckmarkToggle checked={checked} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

const tinyButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 10px',
  fontSize: 12,
  background: 'var(--paper-elev)',
  border: '1px solid var(--rule-strong)',
  color: 'var(--ink)',
  cursor: 'pointer',
  borderRadius: 0,
};

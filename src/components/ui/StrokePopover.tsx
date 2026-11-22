import React, { useEffect, useRef, useState } from 'react';
import { NoSymbolIcon } from '@heroicons/react/24/outline';
import type { BorderStyle } from '../../store/sliceTypes';

/**
 * Floating popover for shape stroke controls:
 *   [none] [solid] [long-dashed] [dashed] [dotted]
 *   Stroke weight  ───────●─────  [ 4 ]
 *
 * Style and weight are intentionally paired here — they share a single
 * mental model (the shape's border/line) — while colour lives in the
 * sidebar along with every other colour picker.
 */

export interface StrokePopoverProps {
  style: BorderStyle;
  weight: number;
  onStyleChange: (next: BorderStyle) => void;
  onWeightChange: (next: number) => void;
  onClose?: () => void;
  min?: number;
  max?: number;
}

const STYLES: ReadonlyArray<{ id: BorderStyle; label: string }> = [
  { id: 'none',        label: 'No stroke' },
  { id: 'solid',       label: 'Solid' },
  { id: 'long-dashed', label: 'Long dashes' },
  { id: 'dashed',      label: 'Short dashes' },
  { id: 'dotted',      label: 'Dotted' },
];

export function StrokePopover({
  style,
  weight,
  onStyleChange,
  onWeightChange,
  onClose,
  min = 0,
  max = 20,
}: StrokePopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [draftWeight, setDraftWeight] = useState<string>(String(weight));

  useEffect(() => {
    setDraftWeight(String(weight));
  }, [weight]);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const commitDraft = () => {
    const parsed = parseInt(draftWeight, 10);
    if (!Number.isFinite(parsed)) {
      setDraftWeight(String(weight));
      return;
    }
    const clamped = Math.max(min, Math.min(max, parsed));
    if (clamped !== weight) onWeightChange(clamped);
    setDraftWeight(String(clamped));
  };

  return (
    <div
      ref={rootRef}
      className="lp-root sp-root"
      role="dialog"
      aria-label="Stroke"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="sp-styles" role="radiogroup" aria-label="Stroke style">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={style === s.id}
            className={`sp-style${style === s.id ? ' sp-style-active' : ''}`}
            title={s.label}
            onClick={() => onStyleChange(s.id)}
          >
            <StyleGlyph style={s.id} />
          </button>
        ))}
      </div>

      <div className="sp-weight">
        <label className="sp-weight-label" htmlFor="sp-weight-range">
          Stroke weight
        </label>
        <div className="sp-weight-row">
          <input
            id="sp-weight-range"
            type="range"
            min={min}
            max={max}
            value={weight}
            onChange={(e) => onWeightChange(parseInt(e.target.value, 10))}
            className="sp-range"
            disabled={style === 'none'}
          />
          <input
            type="number"
            min={min}
            max={max}
            value={draftWeight}
            onChange={(e) => setDraftWeight(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="sp-number"
            disabled={style === 'none'}
            aria-label="Stroke weight, pixels"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Render a small SVG glyph illustrating the given stroke style.
 * Each glyph uses the same viewBox so the style icons align visually.
 */
function StyleGlyph({ style }: { style: BorderStyle }) {
  if (style === 'none') {
    return (
      <NoSymbolIcon className="sp-glyph-icon" aria-hidden="true" />
    );
  }
  const dash = style === 'long-dashed'
    ? '10 5'
    : style === 'dashed'
      ? '4 3'
      : style === 'dotted'
        ? '0.1 4'
        : undefined;
  return (
    <svg
      viewBox="0 0 32 8"
      className="sp-glyph-svg"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <line
        x1="1"
        y1="4"
        x2="31"
        y2="4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  );
}

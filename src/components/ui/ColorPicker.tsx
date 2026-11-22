import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { PlusIcon, SwatchIcon, SparklesIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import { loadRecentColors, pushRecentColor } from '../../utils/documentColors';

/**
 * Shared colour picker used by font colour, text highlight, text-box background,
 * slide background, and shape fill/border. Canva-style information hierarchy:
 * Document → Brand kit → Default solids → Default gradients.
 */

const DEFAULT_SOLIDS: string[] = [
  // Neutrals — warm-tinted paper to near-black ink
  '#1a1a1a', '#333333', '#555555', '#888888', '#bbbbbb', '#dddddd', '#eeeeee', '#fafafa',
  // Warm
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#06b6d4',
  // Cool
  '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
  // Soft pastels
  '#fff3a1', '#ffe3bd', '#fdd0c2', '#f6c6d7', '#e4c0e8', '#c8d2f5', '#b8deda', '#c6e6bc',
  // Paper tones (brand-aligned amber neutrals)
  '#f8f6f1', '#eeeae1', '#d8d2c4', '#b7b0a0', '#7c7767', '#4a4638', '#2b2921', '#faf9f7',
];

const DEFAULT_GRADIENTS: string[] = [
  'linear-gradient(135deg, #1a1a1a 0%, #555555 100%)',
  'linear-gradient(135deg, #dddddd 0%, #fafafa 100%)',
  'linear-gradient(135deg, #bbbbbb 0%, #333333 100%)',
  'linear-gradient(135deg, #333333 0%, #0ea5e9 100%)',
  'linear-gradient(135deg, #2f3383 0%, #6a6fc6 100%)',
  'linear-gradient(135deg, #1a1a2e 0%, #6366f1 100%)',
  'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
  'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #f6c6d7 0%, #c8d2f5 100%)',
  'linear-gradient(135deg, #fff3a1 0%, #fdd0c2 100%)',
];

export interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
  onClear?: () => void;
  documentColors?: string[];
  brandColors?: string[];
  allowGradients?: boolean;
  allowTransparent?: boolean;
  clearLabel?: string;
  showBrandKit?: boolean;
  className?: string;
}

const isHex = (v: string | undefined): v is string =>
  !!v && /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v);

export function ColorPicker({
  value,
  onChange,
  onClear,
  documentColors = [],
  brandColors = [],
  allowGradients = false,
  allowTransparent = false,
  clearLabel = 'No fill',
  showBrandKit = true,
  className,
}: ColorPickerProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customColor, setCustomColor] = useState(isHex(value) ? value : '#2f3383');
  const [recent, setRecent] = useState<string[]>(() => loadRecentColors());

  useEffect(() => {
    if (isHex(value)) setCustomColor(value);
  }, [value]);

  const select = useCallback(
    (color: string) => {
      onChange(color);
      if (isHex(color)) setRecent(pushRecentColor(color));
    },
    [onChange],
  );

  const applyCustom = useCallback(() => {
    select(customColor);
    setCustomOpen(false);
  }, [customColor, select]);

  const normalizedValue = (value ?? '').toLowerCase();
  const isActive = (c: string) =>
    c.toLowerCase() === normalizedValue || c === value;

  const docSwatches = useMemo(() => {
    const recentSet = new Set(recent.map(c => c.toLowerCase()));
    return documentColors.filter(c => !recentSet.has(c.toLowerCase()));
  }, [documentColors, recent]);

  return (
    <div className={`cp-root${className ? ` ${className}` : ''}`}>
      <section className="cp-section">
        <header className="cp-head">
          <SwatchIcon className="cp-head-icon" />
          <span>Document colours</span>
        </header>
        <div className="cp-grid cp-grid-7">
          <button
            type="button"
            className="cp-swatch cp-swatch-custom"
            aria-pressed={customOpen}
            onClick={() => setCustomOpen(v => !v)}
            aria-label="Custom colour"
            title="Custom colour"
          >
            <PlusIcon className="cp-swatch-plus" />
          </button>
          {recent.map(c => (
            <Swatch key={`r-${c}`} color={c} active={isActive(c)} onClick={() => select(c)} />
          ))}
          {docSwatches.map(c => (
            <Swatch key={`d-${c}`} color={c} active={isActive(c)} onClick={() => select(c)} />
          ))}
        </div>

        {customOpen && (
          <div className="cp-custom">
            <HexColorPicker
              color={customColor}
              onChange={setCustomColor}
              style={{ width: '100%', height: 140 }}
            />
            <div className="cp-custom-row">
              <HexColorInput
                color={customColor}
                onChange={setCustomColor}
                prefixed
                className="cp-hex-input"
              />
              <button type="button" className="cp-apply" onClick={applyCustom}>
                Apply
              </button>
            </div>
          </div>
        )}

        {allowTransparent && onClear && (
          <button type="button" className="cp-clear" onClick={onClear}>
            <NoSymbolIcon className="cp-clear-icon" />
            {clearLabel}
          </button>
        )}
      </section>

      {showBrandKit && (
        <section className="cp-section">
          <header className="cp-head">
            <SparklesIcon className="cp-head-icon" />
            <span>Brand kit</span>
          </header>
          {brandColors.length > 0 ? (
            <div className="cp-grid cp-grid-7">
              {brandColors.map(c => (
                <Swatch key={`b-${c}`} color={c} active={isActive(c)} onClick={() => select(c)} />
              ))}
            </div>
          ) : (
            <button type="button" className="cp-brand-empty" disabled title="Brand kits coming soon">
              <PlusIcon className="cp-brand-empty-plus" />
              <span>Add your brand colours</span>
            </button>
          )}
        </section>
      )}

      <section className="cp-section">
        <header className="cp-head">
          <span>Default solid colours</span>
        </header>
        <div className="cp-grid cp-grid-8">
          {DEFAULT_SOLIDS.map(c => (
            <Swatch key={`s-${c}`} color={c} active={isActive(c)} onClick={() => select(c)} />
          ))}
        </div>
      </section>

      {allowGradients && (
        <section className="cp-section">
          <header className="cp-head">
            <span>Default gradient colours</span>
          </header>
          <div className="cp-grid cp-grid-6">
            {DEFAULT_GRADIENTS.map(g => (
              <Swatch
                key={`g-${g}`}
                color={g}
                active={value === g}
                onClick={() => select(g)}
                isGradient
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Swatch({
  color,
  active,
  onClick,
  isGradient,
}: {
  color: string;
  active?: boolean;
  onClick: () => void;
  isGradient?: boolean;
}) {
  return (
    <button
      type="button"
      className={`cp-swatch${isGradient ? ' cp-swatch-gradient' : ''}`}
      style={{ background: color }}
      aria-pressed={active || undefined}
      onClick={onClick}
      title={color}
    />
  );
}

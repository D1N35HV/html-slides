import type { Slide } from '../store/sliceTypes';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const isCssColor = (value: unknown): value is string =>
  typeof value === 'string' && (HEX_RE.test(value) || value.startsWith('rgb'));

export function extractDocumentColors(slides: Slide[], limit = 16): string[] {
  const seen = new Map<string, number>();
  const bump = (raw: unknown) => {
    if (!isCssColor(raw)) return;
    const key = raw.toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  };

  for (const slide of slides) {
    bump(slide.backgroundColor);
    for (const el of slide.elements) {
      const anyEl = el as unknown as Record<string, unknown>;
      bump(anyEl.color);
      bump(anyEl.backgroundColor);
      bump(anyEl.fillColor);
      bump(anyEl.borderColor);
      const content = anyEl.content;
      if (typeof content === 'string') {
        const inline = content.matchAll(/color:\s*(#[0-9a-f]{3,8})/gi);
        for (const m of inline) bump(m[1]);
        const bg = content.matchAll(/background(?:-color)?:\s*(#[0-9a-f]{3,8})/gi);
        for (const m of bg) bump(m[1]);
      }
    }
  }

  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([color]) => color);
}

const RECENT_KEY = 'slide-bolt:recent-colors';
const RECENT_MAX = 8;

export function loadRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is string => typeof c === 'string').slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

export function pushRecentColor(color: string): string[] {
  if (!color) return loadRecentColors();
  const current = loadRecentColors();
  const normalized = color.toLowerCase();
  const next = [color, ...current.filter(c => c.toLowerCase() !== normalized)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — silently skip */
  }
  return next;
}

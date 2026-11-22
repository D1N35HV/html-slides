import type { SlideElement } from '../store/sliceTypes';

/**
 * Ephemeral clipboard for element copy/paste within the editor.
 * Kept outside the store to avoid serializing transient data into
 * undo history and collaboration patches.
 */

type StyleBag = Partial<{
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: string;
  cornerRadius: number;
  color: string;
  backgroundColor: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  textAlign: string;
  lineHeight: number;
  padding: number;
  opacity: number;
}>;

let copiedElement: SlideElement | null = null;
let copiedStyle: StyleBag | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((fn) => fn());

export function subscribeClipboard(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function copyElement(el: SlideElement) {
  copiedElement = JSON.parse(JSON.stringify(el));
  notify();
}

export function getCopiedElement(): SlideElement | null {
  return copiedElement ? (JSON.parse(JSON.stringify(copiedElement)) as SlideElement) : null;
}

export function hasElement() {
  return copiedElement !== null;
}

const STYLE_KEYS: ReadonlyArray<keyof StyleBag> = [
  'fillColor', 'borderColor', 'borderWidth', 'borderStyle', 'cornerRadius',
  'color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight',
  'textAlign', 'lineHeight', 'padding', 'opacity',
];

export function copyStyle(el: SlideElement) {
  const bag: StyleBag = {};
  const source = el as unknown as Record<string, unknown>;
  for (const key of STYLE_KEYS) {
    const v = source[key as string];
    if (v !== undefined && v !== null) {
      (bag as Record<string, unknown>)[key as string] = v;
    }
  }
  copiedStyle = bag;
  notify();
}

export function getCopiedStyle(): StyleBag | null {
  return copiedStyle ? { ...copiedStyle } : null;
}

export function hasStyle() {
  return copiedStyle !== null;
}

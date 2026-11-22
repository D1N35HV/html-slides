// Lenient parser for the chart data editor. Q17: real-world spreadsheet
// data shows up dirty — currency symbols, thousand separators, percent
// signs, SI suffixes, gap markers. The parser cleans those up so paste
// workflows feel painless, and rejects only genuinely uninterpretable input.
//
// Locale: en-US conventions only in v1 (`.` decimal, `,` thousands). European
// decimal-comma (`1,5` meaning 1.5) will mis-parse to 15. Documented as a v1
// constraint in the design brief.

export type ParsedCell =
  | { kind: 'value'; value: number }
  | { kind: 'gap' }
  | { kind: 'reject'; raw: string };

const SI_SUFFIX: Record<string, number> = {
  K: 1e3, k: 1e3,
  M: 1e6, m: 1e6,
  B: 1e9, b: 1e9,
  T: 1e12, t: 1e12,
};

const GAP_TOKENS = new Set([
  '', '-', '—', '–', 'N/A', 'NA', 'n/a', 'null', 'NULL', 'NaN',
]);

export function parseChartCell(raw: unknown): ParsedCell {
  if (raw === null || raw === undefined) return { kind: 'gap' };
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { kind: 'value', value: raw } : { kind: 'gap' };
  }
  if (typeof raw !== 'string') return { kind: 'reject', raw: String(raw) };

  const trimmed = raw.trim();
  if (GAP_TOKENS.has(trimmed)) return { kind: 'gap' };

  // Strip leading currency, trailing percent, and thousand separators in
  // strict en-US digit-group positions. Order matters — strip currency
  // before stripping thousands so '$1,200' → '1,200' → '1200'.
  let s = trimmed;
  s = s.replace(/^[$€£¥₹]\s*/, '');
  s = s.replace(/%\s*$/, '');
  // Thousand separators only when comma sits between three-digit groups.
  // Avoids mauling locale-decimal commas (which would still mis-parse but at
  // least won't be silently rewritten).
  s = s.replace(/(\d),(?=\d{3}(?:\.\d|$|\D))/g, '$1');

  // SI suffix (10K, 1.2M, 3B, 4T). Must consume the entire string.
  const siMatch = /^(-?\d+(?:\.\d+)?)\s*([KkMmBbTt])$/.exec(s);
  if (siMatch) {
    const num = parseFloat(siMatch[1]);
    const mult = SI_SUFFIX[siMatch[2]];
    if (Number.isFinite(num) && mult) return { kind: 'value', value: num * mult };
  }

  // Plain number, including scientific notation. Number() rejects '42abc'
  // (NaN) and accepts '1.2e3' / '-5' / '3.14'.
  if (s === '') return { kind: 'gap' };
  const n = Number(s);
  if (Number.isFinite(n)) return { kind: 'value', value: n };
  return { kind: 'reject', raw };
}

// ──────────────────────────────────────────────────────────────────
// Clipboard paste parsing
// ──────────────────────────────────────────────────────────────────
//
// Q13: HTML-table-first auto-detect, then TSV (tab-separated), then CSV
// (with quoted-string handling), falling back to a single-column read.
// Replaces all data on commit; the caller shows a toast with [Undo].

export interface ParsedPaste {
  /** 2D array, [row][col] of trimmed string cells. */
  rows: string[][];
  /** Whether row 0 looks like a header (all non-numeric, with numeric data below). */
  hasHeader: boolean;
}

export function parseClipboardPaste(html: string | null, plain: string): ParsedPaste | null {
  // 1. HTML table (Excel, Sheets, Numbers all put one on the clipboard).
  if (html) {
    const fromHtml = extractHtmlTable(html);
    if (fromHtml && fromHtml.length > 0) {
      return { rows: fromHtml, hasHeader: detectHeader(fromHtml) };
    }
  }

  // 2. Plain text — split by line, filter empties.
  const lines = plain.split(/\r\n|\n|\r/).map(l => l.replace(/\r$/, ''));
  // Trim trailing empty lines but keep leading/middle empties (an empty cell
  // in the middle of a paste shouldn't collapse a row).
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  if (lines.length === 0) return null;

  // 3. TSV — winner if any line has a tab.
  if (lines.some(l => l.includes('\t'))) {
    const rows = lines.map(l => l.split('\t').map(c => c.trim()));
    return { rows: padRectangular(rows), hasHeader: detectHeader(rows) };
  }

  // 4. CSV with quoted-string handling — tries both styles; takes whichever
  // produces a more rectangular grid. Requires at least one row to have >1
  // column; otherwise falls through to single-column.
  const csvRows = lines.map(parseCsvLine);
  if (csvRows.some(r => r.length > 1)) {
    return { rows: padRectangular(csvRows), hasHeader: detectHeader(csvRows) };
  }

  // 5. Single column.
  const singleCol = lines.map(l => [l.trim()]);
  return { rows: singleCol, hasHeader: detectHeader(singleCol) };
}

function extractHtmlTable(html: string): string[][] | null {
  if (typeof DOMParser === 'undefined') return null;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return null;
    const out: string[][] = [];
    const trList = table.querySelectorAll('tr');
    trList.forEach((tr) => {
      const cells: string[] = [];
      tr.querySelectorAll('td, th').forEach((cell) => {
        cells.push((cell.textContent ?? '').replace(/\s+/g, ' ').trim());
      });
      if (cells.length > 0) out.push(cells);
    });
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') {
        out.push(cur.trim());
        cur = '';
      } else if (ch === '"' && cur.length === 0) {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur.trim());
  return out;
}

function padRectangular(rows: string[][]): string[][] {
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map(r => {
    if (r.length === maxCols) return r;
    const padded = r.slice();
    while (padded.length < maxCols) padded.push('');
    return padded;
  });
}

// Header heuristic: row 0 is non-numeric in every cell, AND row 1+ has at
// least one numeric cell. Matches Excel/Sheets paste conventions.
function detectHeader(rows: string[][]): boolean {
  if (rows.length < 2) return false;
  const row0 = rows[0];
  const row0AllNonNumeric = row0.every(c => parseChartCell(c).kind !== 'value');
  if (!row0AllNonNumeric) return false;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].some(c => parseChartCell(c).kind === 'value')) return true;
  }
  return false;
}

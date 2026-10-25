const UNITS = ["B", "KiB", "MiB", "GiB", "TiB"];

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${UNITS[unit]}`;
}

function truncate(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`;
}

export interface TableOptions {
  /** Total width to fit within; omit for no limit. */
  maxWidth?: number;
  /** Columns to shrink, widest first, when the table is wider than maxWidth. */
  flexColumns?: number[];
}

export function formatTable(headers: string[], rows: string[][], options: TableOptions = {}): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const { maxWidth, flexColumns = [] } = options;
  if (maxWidth !== undefined) {
    let overflow = widths.reduce((sum, w) => sum + w, 0) + 2 * (widths.length - 1) - maxWidth;
    while (overflow > 0) {
      // Shrink the widest column that is still wider than its header.
      const shrinkable = flexColumns.filter((i) => widths[i]! > headers[i]!.length);
      if (shrinkable.length === 0) break;
      const widest = shrinkable.reduce((a, b) => (widths[b]! > widths[a]! ? b : a));
      widths[widest]!--;
      overflow--;
    }
  }
  const line = (cells: string[]) =>
    cells.map((c, i) => truncate(c, widths[i]!).padEnd(widths[i]!)).join("  ").trimEnd();
  return [line(headers), line(widths.map((w) => "-".repeat(w))), ...rows.map(line)].join("\n");
}

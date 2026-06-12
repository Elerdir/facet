/** One row of a hex dump: absolute offset, space-separated hex, ASCII gutter. */
export interface HexRow {
  offset: number;
  hex: string;
  ascii: string;
}

/**
 * Format a byte window into hex-dump rows. Pure and unit-testable; the windowed
 * reading itself happens in the file-system adapter so huge files are never
 * loaded whole.
 */
export function formatHexRows(
  bytes: Uint8Array,
  baseOffset = 0,
  bytesPerRow = 16,
): HexRow[] {
  const rows: HexRow[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerRow) {
    const slice = bytes.subarray(i, i + bytesPerRow);
    const hex = Array.from(slice, (b) => b.toString(16).padStart(2, "0")).join(" ");
    const ascii = Array.from(slice, (b) =>
      b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".",
    ).join("");
    rows.push({ offset: baseOffset + i, hex, ascii });
  }
  return rows;
}

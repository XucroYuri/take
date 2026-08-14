import type { Shot } from './models/types.js';

/**
 * The 3x3 grid (九宫格) is take's signature output: for each shot we derive a
 * 9-cell matrix that simulates a multi-camera setup (left/middle/right ×
 * background/action/foreground). The agent may override cells; core provides
 * the deterministic scaffold.
 */

export type GridCell = 'background' | 'action' | 'foreground';

export interface ShotGrid {
  shotId: string;
  /** Row = depth plane (back/mid/fore), col = horizontal position (L/C/R). */
  cells: string[][];
  /** Per-cell labels for reference, e.g. `[['BG-L','BG-C','BG-R'], ...]`. */
  labels: string[][];
}

const ROW_NAMES: GridCell[] = ['background', 'action', 'foreground'];
const ROW_LABELS: Record<GridCell, string> = { background: 'BG', action: 'AC', foreground: 'FG' };
const COL_NAMES = ['L', 'C', 'R'];

/**
 * Derive a 9-cell grid scaffold from a shot. Cell prompts inherit the shot's
 * imagePrompt and append a depth/position modifier, so the grid stays
 * consistent with the master shot.
 */
export function buildShotGrid(shot: Shot): ShotGrid {
  const cells: string[][] = [];
  const labels: string[][] = [];
  for (const row of ROW_NAMES) {
    const cellRow: string[] = [];
    const labelRow: string[] = [];
    for (const col of COL_NAMES) {
      labelRow.push(`${ROW_LABELS[row]}-${col}`);
      cellRow.push(`${shot.imagePrompt}, ${row} plane, ${col} position, consistent with master shot`);
    }
    cells.push(cellRow);
    labels.push(labelRow);
  }
  return { shotId: shot.id, cells, labels };
}

/** Render a grid as a Markdown table (used for storyboard.md export). */
export function gridToMarkdown(grid: ShotGrid): string {
  const header = `| ${grid.labels.map((r) => r.join(' | ')).join(' | ')} |`;
  // The 9 labels are unique; build a flat 3x3 table.
  const rows = grid.labels.map((r, ri) => `| ${r.map((_, ci) => grid.cells[ri]?.[ci] ?? '').join(' | ')} |`);
  return [header, `| ${grid.labels[0]?.map(() => '---').join(' | ')} |`, ...rows].join('\n');
}

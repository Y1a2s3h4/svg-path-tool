// Core shared types for the SVG Path Positioning Tool

/**
 * A single parsed SVG path command. The command letter preserves its original
 * case (uppercase = absolute, lowercase = relative). `values` always holds the
 * canonical number of arguments for that command because the parser expands
 * implicit/repeated commands into discrete entries.
 *
 * Argument counts:
 *   M/m L/l T/t -> 2   (x y)
 *   H/h V/v     -> 1
 *   C/c         -> 6   (x1 y1 x2 y2 x y)
 *   S/s Q/q     -> 4
 *   A/a         -> 7   (rx ry xAxisRotation largeArcFlag sweepFlag x y)
 *   Z/z         -> 0
 */
export interface Command {
  command: string;
  values: number[];
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface ParsedPath {
  id: string;
  originalPath: string;
  parsedCommands: Command[];
  transformedPath: string;
  position: Vec2; // current top-left (bbox.minX, bbox.minY) — informational
  color: string;
  visible: boolean;
}

export interface Viewport {
  scale: number;
  tx: number; // pan offset in screen pixels
  ty: number;
}

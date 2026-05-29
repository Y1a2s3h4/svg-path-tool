import type { BBox, Command } from '../types';
import { computeBoundingBox } from './boundingBox';

/**
 * Coordinate translation engine.
 *
 * Because the parser already expands implicit commands, every command has a
 * fixed argument layout and translation reduces to a clean per-command rule:
 *
 *   - Absolute commands (uppercase): shift every coordinate pair.
 *       M/L/T: (x,y)            -> +dx,+dy
 *       H:     (x)              -> +dx
 *       V:     (y)              -> +dy
 *       C:     (x1,y1,x2,y2,x,y)-> all pairs +dx,+dy
 *       S/Q:   (..,x,y)         -> all pairs +dx,+dy
 *       A:     (rx,ry,rot,la,sw,x,y) -> only endpoint (x,y)
 *       Z:     no change
 *   - Relative commands (lowercase): unchanged, because they encode offsets
 *     from the previous point and therefore move along with the path — EXCEPT
 *     the very first command if it is a relative moveto `m`, whose first pair
 *     is effectively absolute (relative to the origin) and so must be shifted.
 */
export function translateCommands(commands: Command[], dx: number, dy: number): Command[] {
  if (dx === 0 && dy === 0) return commands.map((c) => ({ command: c.command, values: [...c.values] }));

  return commands.map((cmd, index) => {
    const c = cmd.command;
    const upper = c.toUpperCase();
    const isAbsolute = c === upper;
    const v = [...cmd.values];

    const isFirstRelativeMoveto = index === 0 && c === 'm';

    if (!isAbsolute && !isFirstRelativeMoveto) {
      // Relative command: offsets are translation-invariant.
      return { command: c, values: v };
    }

    switch (upper) {
      case 'M':
      case 'L':
      case 'T':
        v[0] += dx;
        v[1] += dy;
        break;
      case 'H':
        v[0] += dx;
        break;
      case 'V':
        v[0] += dy;
        break;
      case 'C':
        v[0] += dx;
        v[1] += dy;
        v[2] += dx;
        v[3] += dy;
        v[4] += dx;
        v[5] += dy;
        break;
      case 'S':
      case 'Q':
        v[0] += dx;
        v[1] += dy;
        v[2] += dx;
        v[3] += dy;
        break;
      case 'A':
        // rx, ry, rotation and flags are untouched; only the endpoint moves.
        v[5] += dx;
        v[6] += dy;
        break;
      case 'Z':
      default:
        break;
    }
    return { command: c, values: v };
  });
}

/**
 * Translate a path so that its bounding-box top-left corner lands exactly on
 * (targetX, targetY). Returns the new commands plus the delta applied.
 */
export function moveTo(
  commands: Command[],
  targetX: number,
  targetY: number,
  bbox?: BBox,
): { commands: Command[]; dx: number; dy: number } {
  const box = bbox ?? computeBoundingBox(commands);
  const dx = targetX - box.minX;
  const dy = targetY - box.minY;
  return { commands: translateCommands(commands, dx, dy), dx, dy };
}

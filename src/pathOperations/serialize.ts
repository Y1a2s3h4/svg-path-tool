import type { Command } from '../types';

/** Format a number with limited precision, trimming trailing zeros. */
export function formatNumber(n: number, precision = 3): string {
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  const fixed = n.toFixed(precision);
  // Trim trailing zeros and a dangling decimal point.
  return fixed.replace(/\.?0+$/, '');
}

/**
 * Serialize commands back into an SVG path string. Command case (absolute vs
 * relative) is preserved. Arc flags are emitted as integers.
 */
export function serializePath(commands: Command[], precision = 3): string {
  const parts: string[] = [];

  for (const cmd of commands) {
    const upper = cmd.command.toUpperCase();
    if (upper === 'Z') {
      parts.push(cmd.command);
      continue;
    }

    if (upper === 'A') {
      const [rx, ry, rot, la, sw, x, y] = cmd.values;
      parts.push(
        `${cmd.command}${formatNumber(rx, precision)} ${formatNumber(ry, precision)} ` +
          `${formatNumber(rot, precision)} ${la ? 1 : 0} ${sw ? 1 : 0} ` +
          `${formatNumber(x, precision)} ${formatNumber(y, precision)}`,
      );
      continue;
    }

    const nums = cmd.values.map((n) => formatNumber(n, precision)).join(' ');
    parts.push(`${cmd.command}${nums}`);
  }

  return parts.join(' ');
}

/** Build a full standalone <svg> document for one or more path strings. */
export function buildSvgDocument(
  paths: { d: string; fill?: string; stroke?: string }[],
  width: number,
  height: number,
): string {
  const body = paths
    .map(
      (p) =>
        `  <path d="${p.d}" fill="${p.fill ?? 'none'}" stroke="${p.stroke ?? '#000000'}" stroke-width="1"/>`,
    )
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${body}\n</svg>`;
}

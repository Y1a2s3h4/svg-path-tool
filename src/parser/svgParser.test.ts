import { describe, it, expect } from 'vitest';
import { parsePath, tryParsePath, SvgPathParseError } from './svgParser';

describe('parsePath — basics', () => {
  it('parses a simple M/L pair', () => {
    expect(parsePath('M0 10 L50 60')).toEqual([
      { command: 'M', values: [0, 10] },
      { command: 'L', values: [50, 60] },
    ]);
  });

  it('returns empty array for empty / whitespace input', () => {
    expect(parsePath('')).toEqual([]);
    expect(parsePath('   \n\t ')).toEqual([]);
  });

  it('handles comma separators', () => {
    expect(parsePath('M0,10 L50,60')).toEqual([
      { command: 'M', values: [0, 10] },
      { command: 'L', values: [50, 60] },
    ]);
  });

  it('handles mixed and missing whitespace', () => {
    expect(parsePath('M0 10L50 60')).toEqual([
      { command: 'M', values: [0, 10] },
      { command: 'L', values: [50, 60] },
    ]);
  });
});

describe('parsePath — numbers', () => {
  it('handles negative numbers without separators', () => {
    expect(parsePath('M-0 8.9609V0.0001H1.2329')).toEqual([
      { command: 'M', values: [-0, 8.9609] },
      { command: 'V', values: [0.0001] },
      { command: 'H', values: [1.2329] },
    ]);
  });

  it('treats a sign as a number boundary: "1-2" -> [1, -2]', () => {
    expect(parsePath('M1-2')).toEqual([{ command: 'M', values: [1, -2] }]);
  });

  it('treats a second decimal point as a new number: "1.5.5" -> [1.5, 0.5]', () => {
    expect(parsePath('M1.5.5')).toEqual([{ command: 'M', values: [1.5, 0.5] }]);
  });

  it('parses scientific notation', () => {
    expect(parsePath('M1e2 2e-1')).toEqual([{ command: 'M', values: [100, 0.2] }]);
  });

  it('parses leading-dot fractions', () => {
    expect(parsePath('M.5 .25')).toEqual([{ command: 'M', values: [0.5, 0.25] }]);
  });

  it('parses positive signs', () => {
    expect(parsePath('M+5 +6')).toEqual([{ command: 'M', values: [5, 6] }]);
  });
});

describe('parsePath — implicit/repeated commands', () => {
  it('expands repeated coordinate pairs after M into L', () => {
    expect(parsePath('M10 20 30 40')).toEqual([
      { command: 'M', values: [10, 20] },
      { command: 'L', values: [30, 40] },
    ]);
  });

  it('expands repeated relative moveto into relative lineto', () => {
    expect(parsePath('m10 20 30 40')).toEqual([
      { command: 'm', values: [10, 20] },
      { command: 'l', values: [30, 40] },
    ]);
  });

  it('expands repeated L commands', () => {
    expect(parsePath('M0 0 L1 1 2 2 3 3')).toEqual([
      { command: 'M', values: [0, 0] },
      { command: 'L', values: [1, 1] },
      { command: 'L', values: [2, 2] },
      { command: 'L', values: [3, 3] },
    ]);
  });

  it('expands repeated cubic curves', () => {
    expect(parsePath('M0 0 C1 1 2 2 3 3 4 4 5 5 6 6')).toEqual([
      { command: 'M', values: [0, 0] },
      { command: 'C', values: [1, 1, 2, 2, 3, 3] },
      { command: 'C', values: [4, 4, 5, 5, 6, 6] },
    ]);
  });
});

describe('parsePath — every command type', () => {
  it('parses H and V', () => {
    expect(parsePath('M0 0 H50 V25 h-10 v-5')).toEqual([
      { command: 'M', values: [0, 0] },
      { command: 'H', values: [50] },
      { command: 'V', values: [25] },
      { command: 'h', values: [-10] },
      { command: 'v', values: [-5] },
    ]);
  });

  it('parses C, S, Q, T', () => {
    const out = parsePath('M0 0 C1 2 3 4 5 6 S7 8 9 10 Q11 12 13 14 T15 16');
    expect(out).toEqual([
      { command: 'M', values: [0, 0] },
      { command: 'C', values: [1, 2, 3, 4, 5, 6] },
      { command: 'S', values: [7, 8, 9, 10] },
      { command: 'Q', values: [11, 12, 13, 14] },
      { command: 'T', values: [15, 16] },
    ]);
  });

  it('parses Z and z', () => {
    expect(parsePath('M0 0 L1 1 Z')).toEqual([
      { command: 'M', values: [0, 0] },
      { command: 'L', values: [1, 1] },
      { command: 'Z', values: [] },
    ]);
    expect(parsePath('M0 0 L1 1 z')[2]).toEqual({ command: 'z', values: [] });
  });
});

describe('parsePath — arcs (the hard case)', () => {
  it('parses a well-spaced arc', () => {
    expect(parsePath('M0 0 A25 25 -30 0 1 50 -25')).toEqual([
      { command: 'M', values: [0, 0] },
      { command: 'A', values: [25, 25, -30, 0, 1, 50, -25] },
    ]);
  });

  it('parses arc flags written without separators', () => {
    // "...0 1..." compressed to "...01..." and the endpoint glued on
    expect(parsePath('M0 0 a25 25 -30 0150 -25')).toEqual([
      { command: 'M', values: [0, 0] },
      { command: 'a', values: [25, 25, -30, 0, 1, 50, -25] },
    ]);
  });

  it('parses repeated arcs', () => {
    expect(parsePath('M0 0 A5 5 0 1 1 10 10 5 5 0 0 0 20 20')).toEqual([
      { command: 'M', values: [0, 0] },
      { command: 'A', values: [5, 5, 0, 1, 1, 10, 10] },
      { command: 'A', values: [5, 5, 0, 0, 0, 20, 20] },
    ]);
  });
});

describe('parsePath — errors', () => {
  it('rejects paths not starting with a moveto', () => {
    expect(() => parsePath('L10 10')).toThrow(SvgPathParseError);
  });

  it('rejects an unknown command letter', () => {
    expect(() => parsePath('M0 0 K5 5')).toThrow(SvgPathParseError);
  });

  it('rejects a bad arc flag', () => {
    expect(() => parsePath('M0 0 A5 5 0 2 1 10 10')).toThrow(SvgPathParseError);
  });

  it('tryParsePath reports errors instead of throwing', () => {
    const { commands, error } = tryParsePath('L10 10');
    expect(commands).toEqual([]);
    expect(error).toBeTruthy();
  });
});

describe('parsePath — realistic glyph-ish path', () => {
  it('parses a multi-subpath path with mixed commands', () => {
    const d = 'M -0 8.9609 V 0.0001 H 1.2329 V 7.5 C 1.2 7.8 1.5 8.9 2 9 Z M 3 3 l 1 1 z';
    const out = parsePath(d);
    expect(out[0]).toEqual({ command: 'M', values: [-0, 8.9609] });
    expect(out[1]).toEqual({ command: 'V', values: [0.0001] });
    expect(out.filter((c) => c.command.toUpperCase() === 'Z')).toHaveLength(2);
    expect(out.find((c) => c.command === 'C')).toEqual({
      command: 'C',
      values: [1.2, 7.8, 1.5, 8.9, 2, 9],
    });
  });
});

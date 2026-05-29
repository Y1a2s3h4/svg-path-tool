import { describe, it, expect } from 'vitest';
import { parsePath } from '../parser/svgParser';
import { translateCommands, moveTo } from './translate';
import { computeBoundingBox } from './boundingBox';
import { serializePath } from './serialize';

describe('translateCommands', () => {
  it('shifts absolute coordinates', () => {
    const cmds = parsePath('M10 20 L30 40');
    expect(translateCommands(cmds, 5, -5)).toEqual([
      { command: 'M', values: [15, 15] },
      { command: 'L', values: [35, 35] },
    ]);
  });

  it('shifts only x for H and only y for V', () => {
    const cmds = parsePath('M0 0 H50 V25');
    expect(translateCommands(cmds, 10, 100)).toEqual([
      { command: 'M', values: [10, 100] },
      { command: 'H', values: [60] },
      { command: 'V', values: [125] },
    ]);
  });

  it('leaves relative commands unchanged but shifts the leading absolute M', () => {
    const cmds = parsePath('M0 0 l10 0 l0 10 z');
    expect(translateCommands(cmds, 7, 3)).toEqual([
      { command: 'M', values: [7, 3] },
      { command: 'l', values: [10, 0] },
      { command: 'l', values: [0, 10] },
      { command: 'z', values: [] },
    ]);
  });

  it('shifts the first pair of a leading relative moveto', () => {
    const cmds = parsePath('m5 5 l10 0');
    expect(translateCommands(cmds, 2, 2)).toEqual([
      { command: 'm', values: [7, 7] },
      { command: 'l', values: [10, 0] },
    ]);
  });

  it('translates only the endpoint of an absolute arc', () => {
    const cmds = parsePath('M0 0 A25 25 -30 0 1 50 -25');
    expect(translateCommands(cmds, 100, 200)).toEqual([
      { command: 'M', values: [100, 200] },
      { command: 'A', values: [25, 25, -30, 0, 1, 150, 175] },
    ]);
  });

  it('shifts all cubic control points', () => {
    const cmds = parsePath('M0 0 C1 1 2 2 3 3');
    expect(translateCommands(cmds, 10, 20)).toEqual([
      { command: 'M', values: [10, 20] },
      { command: 'C', values: [11, 21, 12, 22, 13, 23] },
    ]);
  });
});

describe('computeBoundingBox', () => {
  it('computes a rectangle bbox from lines', () => {
    const box = computeBoundingBox(parsePath('M10 20 L110 20 L110 60 L10 60 Z'));
    expect(box).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 60, width: 100, height: 40 });
  });

  it('handles relative paths', () => {
    const box = computeBoundingBox(parsePath('m10 10 l20 0 l0 20 l-20 0 z'));
    expect(box).toEqual({ minX: 10, minY: 10, maxX: 30, maxY: 30, width: 20, height: 20 });
  });

  it('captures cubic extrema beyond endpoints', () => {
    // A curve that bows outward — bbox should exceed the endpoints.
    const box = computeBoundingBox(parsePath('M0 0 C0 100 100 100 100 0'));
    expect(box.minX).toBeCloseTo(0, 3);
    expect(box.maxX).toBeCloseTo(100, 3);
    expect(box.minY).toBeCloseTo(0, 3);
    // peak of the curve is at y = 75, not 100 (control points overshoot)
    expect(box.maxY).toBeCloseTo(75, 1);
  });

  it('captures arc extents via sampling', () => {
    // Semicircle from (0,0) to (100,0), radius 50.
    // sweep=0 bulges downward (+y); sweep=1 bulges upward (-y) in SVG's y-down space.
    const down = computeBoundingBox(parsePath('M0 0 A50 50 0 0 0 100 0'));
    expect(down.minX).toBeCloseTo(0, 1);
    expect(down.maxX).toBeCloseTo(100, 1);
    expect(down.maxY).toBeCloseTo(50, 1);

    const up = computeBoundingBox(parsePath('M0 0 A50 50 0 0 1 100 0'));
    expect(up.minY).toBeCloseTo(-50, 1);
    expect(up.maxY).toBeCloseTo(0, 1);
  });
});

describe('moveTo', () => {
  it('lands the bbox top-left exactly on the target', () => {
    const cmds = parsePath('M10 20 L110 20 L110 60 Z');
    const { commands } = moveTo(cmds, 120, 280);
    const box = computeBoundingBox(commands);
    expect(box.minX).toBeCloseTo(120, 6);
    expect(box.minY).toBeCloseTo(280, 6);
  });
});

describe('serializePath round-trip', () => {
  it('serializes back to a parseable, equivalent path', () => {
    const original = 'M10 20 L30 40 C1 2 3 4 5 6 A5 5 0 0 1 7 8 Z';
    const cmds = parsePath(original);
    const out = serializePath(cmds);
    // re-parsing the serialized output yields identical command structure
    expect(parsePath(out)).toEqual(cmds);
  });

  it('trims trailing zeros', () => {
    const cmds = parsePath('M1.5000 2.2500');
    expect(serializePath(cmds)).toBe('M1.5 2.25');
  });
});

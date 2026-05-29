import type { BBox, Command, Vec2 } from '../types';

/**
 * Computes an accurate bounding box for a parsed path.
 *
 * Lines and endpoints are exact. Cubic and quadratic Béziers use analytic
 * derivative roots to find true extrema (control points alone overshoot).
 * Elliptical arcs are flattened by sampling, which is accurate to sub-pixel
 * for any reasonable arc.
 *
 * Handles absolute/relative commands, smooth curve reflection (S/T), and
 * subpath start tracking for Z.
 */

const ARC_SAMPLES = 64;

interface Acc {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function include(acc: Acc, x: number, y: number): void {
  if (x < acc.minX) acc.minX = x;
  if (y < acc.minY) acc.minY = y;
  if (x > acc.maxX) acc.maxX = x;
  if (y > acc.maxY) acc.maxY = y;
}

function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

function quadAt(p0: number, p1: number, p2: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

/** Roots of the derivative of a cubic Bézier on one axis, clamped to (0,1). */
function cubicExtremaT(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const ts: number[] = [];
  const eps = 1e-9;
  if (Math.abs(a) < eps) {
    if (Math.abs(b) > eps) {
      const t = -c / b;
      if (t > 0 && t < 1) ts.push(t);
    }
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const t1 = (-b + sq) / (2 * a);
      const t2 = (-b - sq) / (2 * a);
      if (t1 > 0 && t1 < 1) ts.push(t1);
      if (t2 > 0 && t2 < 1) ts.push(t2);
    }
  }
  return ts;
}

function quadExtremaT(p0: number, p1: number, p2: number): number[] {
  const denom = p0 - 2 * p1 + p2;
  if (Math.abs(denom) < 1e-9) return [];
  const t = (p0 - p1) / denom;
  return t > 0 && t < 1 ? [t] : [];
}

function addCubic(acc: Acc, p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2): void {
  include(acc, p3.x, p3.y);
  for (const t of cubicExtremaT(p0.x, p1.x, p2.x, p3.x)) {
    include(acc, cubicAt(p0.x, p1.x, p2.x, p3.x, t), cubicAt(p0.y, p1.y, p2.y, p3.y, t));
  }
  for (const t of cubicExtremaT(p0.y, p1.y, p2.y, p3.y)) {
    include(acc, cubicAt(p0.x, p1.x, p2.x, p3.x, t), cubicAt(p0.y, p1.y, p2.y, p3.y, t));
  }
}

function addQuad(acc: Acc, p0: Vec2, p1: Vec2, p2: Vec2): void {
  include(acc, p2.x, p2.y);
  for (const t of quadExtremaT(p0.x, p1.x, p2.x)) {
    include(acc, quadAt(p0.x, p1.x, p2.x, t), quadAt(p0.y, p1.y, p2.y, t));
  }
  for (const t of quadExtremaT(p0.y, p1.y, p2.y)) {
    include(acc, quadAt(p0.x, p1.x, p2.x, t), quadAt(p0.y, p1.y, p2.y, t));
  }
}

/** Sample an elliptical arc from (x1,y1) to (x2,y2) and feed points to acc. */
function addArc(
  acc: Acc,
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  phiDeg: number,
  largeArc: number,
  sweep: number,
  x2: number,
  y2: number,
): void {
  include(acc, x2, y2);
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) {
    include(acc, x1, y1);
    return;
  }
  const phi = (phiDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: compute (x1', y1')
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Correct out-of-range radii
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  // Step 2: compute center (cx', cy')
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const x1p2 = x1p * x1p;
  const y1p2 = y1p * y1p;
  let num = rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2;
  if (num < 0) num = 0;
  const denom = rx2 * y1p2 + ry2 * x1p2;
  let coef = denom === 0 ? 0 : Math.sqrt(num / denom);
  if (largeArc === sweep) coef = -coef;
  const cxp = (coef * (rx * y1p)) / ry;
  const cyp = (coef * -(ry * x1p)) / rx;

  // Step 3: compute (cx, cy)
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Step 4: angles
  const angle = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = angle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  );
  if (sweep === 0 && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep === 1 && dTheta < 0) dTheta += 2 * Math.PI;

  for (let i = 1; i < ARC_SAMPLES; i++) {
    const t = theta1 + (dTheta * i) / ARC_SAMPLES;
    const ex = cosPhi * rx * Math.cos(t) - sinPhi * ry * Math.sin(t) + cx;
    const ey = sinPhi * rx * Math.cos(t) + cosPhi * ry * Math.sin(t) + cy;
    include(acc, ex, ey);
  }
}

/**
 * Walk the command list maintaining absolute current point, subpath start,
 * and the previous control point (for smooth S/T reflection).
 */
export function computeBoundingBox(commands: Command[]): BBox {
  const acc: Acc = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };

  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  // Last cubic/quad control point (absolute) for smooth-curve reflection.
  let prevCubicCtrl: Vec2 | null = null;
  let prevQuadCtrl: Vec2 | null = null;
  let prevType = '';

  for (const cmd of commands) {
    const c = cmd.command;
    const upper = c.toUpperCase();
    const rel = c === c.toLowerCase() && c !== c.toUpperCase();
    const v = cmd.values;

    switch (upper) {
      case 'M': {
        const x = rel ? cx + v[0] : v[0];
        const y = rel ? cy + v[1] : v[1];
        cx = x;
        cy = y;
        startX = x;
        startY = y;
        include(acc, x, y);
        prevCubicCtrl = null;
        prevQuadCtrl = null;
        break;
      }
      case 'L': {
        const x = rel ? cx + v[0] : v[0];
        const y = rel ? cy + v[1] : v[1];
        cx = x;
        cy = y;
        include(acc, x, y);
        prevCubicCtrl = null;
        prevQuadCtrl = null;
        break;
      }
      case 'H': {
        const x = rel ? cx + v[0] : v[0];
        cx = x;
        include(acc, x, cy);
        prevCubicCtrl = null;
        prevQuadCtrl = null;
        break;
      }
      case 'V': {
        const y = rel ? cy + v[0] : v[0];
        cy = y;
        include(acc, cx, y);
        prevCubicCtrl = null;
        prevQuadCtrl = null;
        break;
      }
      case 'C': {
        const p0 = { x: cx, y: cy };
        const p1 = { x: rel ? cx + v[0] : v[0], y: rel ? cy + v[1] : v[1] };
        const p2 = { x: rel ? cx + v[2] : v[2], y: rel ? cy + v[3] : v[3] };
        const p3 = { x: rel ? cx + v[4] : v[4], y: rel ? cy + v[5] : v[5] };
        addCubic(acc, p0, p1, p2, p3);
        cx = p3.x;
        cy = p3.y;
        prevCubicCtrl = p2;
        prevQuadCtrl = null;
        break;
      }
      case 'S': {
        const p0 = { x: cx, y: cy };
        const reflect =
          prevType === 'C' || prevType === 'S'
            ? { x: 2 * cx - (prevCubicCtrl?.x ?? cx), y: 2 * cy - (prevCubicCtrl?.y ?? cy) }
            : { x: cx, y: cy };
        const p2 = { x: rel ? cx + v[0] : v[0], y: rel ? cy + v[1] : v[1] };
        const p3 = { x: rel ? cx + v[2] : v[2], y: rel ? cy + v[3] : v[3] };
        addCubic(acc, p0, reflect, p2, p3);
        cx = p3.x;
        cy = p3.y;
        prevCubicCtrl = p2;
        prevQuadCtrl = null;
        break;
      }
      case 'Q': {
        const p0 = { x: cx, y: cy };
        const p1 = { x: rel ? cx + v[0] : v[0], y: rel ? cy + v[1] : v[1] };
        const p2 = { x: rel ? cx + v[2] : v[2], y: rel ? cy + v[3] : v[3] };
        addQuad(acc, p0, p1, p2);
        cx = p2.x;
        cy = p2.y;
        prevQuadCtrl = p1;
        prevCubicCtrl = null;
        break;
      }
      case 'T': {
        const p0 = { x: cx, y: cy };
        const p1: Vec2 =
          prevType === 'Q' || prevType === 'T'
            ? { x: 2 * cx - (prevQuadCtrl?.x ?? cx), y: 2 * cy - (prevQuadCtrl?.y ?? cy) }
            : { x: cx, y: cy };
        const p2 = { x: rel ? cx + v[0] : v[0], y: rel ? cy + v[1] : v[1] };
        addQuad(acc, p0, p1, p2);
        cx = p2.x;
        cy = p2.y;
        prevQuadCtrl = p1;
        prevCubicCtrl = null;
        break;
      }
      case 'A': {
        const x = rel ? cx + v[5] : v[5];
        const y = rel ? cy + v[6] : v[6];
        addArc(acc, cx, cy, v[0], v[1], v[2], v[3], v[4], x, y);
        cx = x;
        cy = y;
        prevCubicCtrl = null;
        prevQuadCtrl = null;
        break;
      }
      case 'Z': {
        cx = startX;
        cy = startY;
        prevCubicCtrl = null;
        prevQuadCtrl = null;
        break;
      }
    }
    prevType = upper;
  }

  if (!Number.isFinite(acc.minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  return {
    minX: acc.minX,
    minY: acc.minY,
    maxX: acc.maxX,
    maxY: acc.maxY,
    width: acc.maxX - acc.minX,
    height: acc.maxY - acc.minY,
  };
}

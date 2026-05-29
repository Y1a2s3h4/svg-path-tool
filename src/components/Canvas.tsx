import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathStore } from '../store/usePathStore';
import { usePathBBox } from '../hooks/usePathTransform';
import { PathRenderer } from './PathRenderer';

const GRID_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
const TARGET_PX = 64; // desired on-screen spacing between grid lines

function chooseStep(scale: number): number {
  for (const s of GRID_STEPS) {
    if (s * scale >= TARGET_PX) return s;
  }
  return GRID_STEPS[GRID_STEPS.length - 1];
}

interface DragState {
  mode: 'pan' | 'path' | null;
  startX: number;
  startY: number;
  startTx: number;
  startTy: number;
  pathId: string | null;
}

export function Canvas() {
  const paths = usePathStore((s) => s.paths);
  const selectedId = usePathStore((s) => s.selectedId);
  const viewport = usePathStore((s) => s.viewport);
  const doc = usePathStore((s) => s.doc);
  const setViewport = usePathStore((s) => s.setViewport);
  const selectPath = usePathStore((s) => s.selectPath);
  const translateSelected = usePathStore((s) => s.translateSelected);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const dragRef = useRef<DragState>({
    mode: null,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
    pathId: null,
  });
  const rafRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const offsetRef = useRef<{ x: number; y: number } | null>(null);

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { scale, tx, ty } = viewport;
  const toScreenX = (wx: number) => wx * scale + tx;
  const toScreenY = (wy: number) => wy * scale + ty;

  // --- Pointer handling -------------------------------------------------
  const onPathPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.stopPropagation();
      selectPath(id);
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragRef.current = {
        mode: 'path',
        startX: e.clientX,
        startY: e.clientY,
        startTx: tx,
        startTy: ty,
        pathId: id,
      };
    },
    [selectPath, tx, ty],
  );

  const onBackgroundPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      dragRef.current = {
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        startTx: tx,
        startTy: ty,
        pathId: null,
      };
    },
    [tx, ty],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d.mode) return;
      const dxScreen = e.clientX - d.startX;
      const dyScreen = e.clientY - d.startY;

      if (d.mode === 'pan') {
        setViewport({ tx: d.startTx + dxScreen, ty: d.startTy + dyScreen });
        return;
      }

      // path drag — throttle with rAF and apply a transform offset
      const next = { x: dxScreen / scale, y: dyScreen / scale };
      offsetRef.current = next;
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setDragOffset(offsetRef.current);
        });
      }
    },
    [scale, setViewport],
  );

  const endDrag = useCallback(() => {
    const d = dragRef.current;
    if (d.mode === 'path' && offsetRef.current) {
      const { x, y } = offsetRef.current;
      if (x !== 0 || y !== 0) translateSelected(x, y);
    }
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    dragRef.current.mode = null;
    offsetRef.current = null;
    setDragOffset(null);
  }, [translateSelected]);

  // --- Zoom -------------------------------------------------------------
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const newScale = Math.min(50, Math.max(0.05, scale * factor));
      // keep the world point under the cursor fixed
      const wx = (px - tx) / scale;
      const wy = (py - ty) / scale;
      setViewport({ scale: newScale, tx: px - wx * newScale, ty: py - wy * newScale });
    },
    [scale, tx, ty, setViewport],
  );

  // --- Grid + ruler ticks ----------------------------------------------
  const step = chooseStep(scale);
  const worldLeft = -tx / scale;
  const worldTop = -ty / scale;
  const worldRight = (size.w - tx) / scale;
  const worldBottom = (size.h - ty) / scale;

  const xTicks: number[] = [];
  const yTicks: number[] = [];
  for (let x = Math.ceil(worldLeft / step) * step; x <= worldRight; x += step) xTicks.push(x);
  for (let y = Math.ceil(worldTop / step) * step; y <= worldBottom; y += step) yTicks.push(y);

  const selectedBBox = usePathBBox(paths.find((p) => p.id === selectedId) ?? null);

  return (
    <div className="canvas" ref={containerRef}>
      <svg
        className="canvas-svg"
        width={size.w}
        height={size.h}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onWheel={onWheel}
      >
        {/* grid */}
        <g>
          {xTicks.map((x) => {
            const sx = toScreenX(x);
            const axis = Math.abs(x) < 1e-6;
            return (
              <line
                key={`gx${x}`}
                x1={sx}
                y1={0}
                x2={sx}
                y2={size.h}
                className={axis ? 'grid-axis' : 'grid-line'}
              />
            );
          })}
          {yTicks.map((y) => {
            const sy = toScreenY(y);
            const axis = Math.abs(y) < 1e-6;
            return (
              <line
                key={`gy${y}`}
                x1={0}
                y1={sy}
                x2={size.w}
                y2={sy}
                className={axis ? 'grid-axis' : 'grid-line'}
              />
            );
          })}
        </g>

        {/* document frame (used by alignment tools) */}
        <rect
          x={toScreenX(0)}
          y={toScreenY(0)}
          width={doc.width * scale}
          height={doc.height * scale}
          className="doc-frame"
        />

        {/* origin indicator */}
        <g className="origin">
          <circle cx={toScreenX(0)} cy={toScreenY(0)} r={4} />
          <line x1={toScreenX(0) - 9} y1={toScreenY(0)} x2={toScreenX(0) + 9} y2={toScreenY(0)} />
          <line x1={toScreenX(0)} y1={toScreenY(0) - 9} x2={toScreenX(0)} y2={toScreenY(0) + 9} />
        </g>

        {/* paths (world space) */}
        <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
          {paths.map((p) => (
            <PathRenderer
              key={p.id}
              path={p}
              selected={p.id === selectedId}
              offset={p.id === selectedId ? dragOffset : null}
              onPointerDown={onPathPointerDown}
            />
          ))}

          {/* selection bbox outline */}
          {selectedBBox && (
            <rect
              x={selectedBBox.minX + (dragOffset?.x ?? 0)}
              y={selectedBBox.minY + (dragOffset?.y ?? 0)}
              width={selectedBBox.width}
              height={selectedBBox.height}
              className="selection-box"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </g>
      </svg>

      {/* rulers */}
      <div className="ruler ruler-top">
        {xTicks.map((x) => (
          <span key={`rx${x}`} className="tick" style={{ left: toScreenX(x) }}>
            {x}
          </span>
        ))}
      </div>
      <div className="ruler ruler-left">
        {yTicks.map((y) => (
          <span key={`ry${y}`} className="tick" style={{ top: toScreenY(y) }}>
            {y}
          </span>
        ))}
      </div>
      <div className="ruler-corner" />

      <div className="zoom-readout">{Math.round(scale * 100)}%</div>
    </div>
  );
}

import { memo } from 'react';
import type { ParsedPath } from '../types';

interface Props {
  path: ParsedPath;
  selected: boolean;
  offset: { x: number; y: number } | null;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
}

/**
 * Renders one path. While dragging, a transform offset is applied to the group
 * instead of re-serializing thousands of coordinates every frame — the offset
 * is baked into real coordinates only when the drag ends.
 */
function PathRendererInner({ path, selected, offset, onPointerDown }: Props) {
  if (!path.visible) return null;
  const transform = offset ? `translate(${offset.x} ${offset.y})` : undefined;

  return (
    <g transform={transform}>
      {/* Wide invisible hit area for easier grabbing */}
      <path
        d={path.transformedPath}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        vectorEffect="non-scaling-stroke"
        style={{ cursor: 'grab', pointerEvents: 'stroke' }}
        onPointerDown={(e) => onPointerDown(e, path.id)}
      />
      <path
        d={path.transformedPath}
        fill={path.color}
        fillOpacity={selected ? 0.22 : 0.14}
        stroke={path.color}
        strokeWidth={selected ? 2 : 1.25}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}

export const PathRenderer = memo(PathRendererInner);

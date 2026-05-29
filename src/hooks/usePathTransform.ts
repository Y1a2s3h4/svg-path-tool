import { useMemo } from 'react';
import type { BBox, ParsedPath } from '../types';
import { computeBoundingBox } from '../pathOperations/boundingBox';

/**
 * Memoized bounding box for a path. Recomputes only when the underlying
 * parsedCommands reference changes (which happens on a baked transform, not on
 * every render or during a drag), keeping large paths cheap.
 */
export function usePathBBox(path: ParsedPath | null): BBox | null {
  return useMemo(() => {
    if (!path) return null;
    return computeBoundingBox(path.parsedCommands);
  }, [path?.parsedCommands]);
}

export interface TransformInfo {
  bbox: BBox | null;
  /** number of coordinate values across all commands (rough complexity metric) */
  coordinateCount: number;
}

export function usePathTransform(path: ParsedPath | null): TransformInfo {
  const bbox = usePathBBox(path);
  const coordinateCount = useMemo(() => {
    if (!path) return 0;
    return path.parsedCommands.reduce((sum, c) => sum + c.values.length, 0);
  }, [path?.parsedCommands]);
  return { bbox, coordinateCount };
}

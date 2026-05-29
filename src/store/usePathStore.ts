import { create } from 'zustand';
import type { Command, ParsedPath, Vec2, Viewport } from '../types';
import { parsePath } from '../parser/svgParser';
import { serializePath } from '../pathOperations/serialize';
import { translateCommands, moveTo } from '../pathOperations/translate';
import { computeBoundingBox } from '../pathOperations/boundingBox';
import { colorForIndex, nextId } from '../utils/id';

interface DocSize {
  width: number;
  height: number;
}

interface State {
  paths: ParsedPath[];
  selectedId: string | null;
  viewport: Viewport;
  doc: DocSize;
  precision: number;

  past: ParsedPath[][];
  future: ParsedPath[][];

  // queries
  selected: () => ParsedPath | null;

  // path management
  addPath: (raw: string, color?: string) => { ok: boolean; error?: string };
  addManyPaths: (raws: string[]) => void;
  removePath: (id: string) => void;
  clearPaths: () => void;
  selectPath: (id: string | null) => void;
  toggleVisible: (id: string) => void;
  setColor: (id: string, color: string) => void;

  // transforms
  translateSelected: (dx: number, dy: number) => void;
  moveSelectedTo: (x: number, y: number) => void;

  // viewport
  setViewport: (v: Partial<Viewport>) => void;
  resetViewport: () => void;
  setDoc: (d: Partial<DocSize>) => void;
  setPrecision: (p: number) => void;

  // history
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function makePath(raw: string, color: string): ParsedPath {
  const commands = parsePath(raw);
  const box = computeBoundingBox(commands);
  return {
    id: nextId(),
    originalPath: raw.trim(),
    parsedCommands: commands,
    transformedPath: serializePath(commands),
    position: { x: box.minX, y: box.minY },
    color,
    visible: true,
  };
}

function recompute(path: ParsedPath, commands: Command[], precision: number): ParsedPath {
  const box = computeBoundingBox(commands);
  return {
    ...path,
    parsedCommands: commands,
    transformedPath: serializePath(commands, precision),
    position: { x: box.minX, y: box.minY },
  };
}

export const usePathStore = create<State>((set, get) => {
  /** Push current paths onto the undo stack, clear redo, then apply new paths. */
  const commit = (paths: ParsedPath[]) => {
    set((s) => ({
      past: [...s.past, s.paths].slice(-100),
      future: [],
      paths,
    }));
  };

  return {
    paths: [],
    selectedId: null,
    viewport: { scale: 1, tx: 80, ty: 80 },
    doc: { width: 800, height: 600 },
    precision: 3,
    past: [],
    future: [],

    selected: () => {
      const { paths, selectedId } = get();
      return paths.find((p) => p.id === selectedId) ?? null;
    },

    addPath: (raw) => {
      const trimmed = raw.trim();
      if (!trimmed) return { ok: false, error: 'Empty path' };
      try {
        const color = colorForIndex(get().paths.length);
        const path = makePath(trimmed, color);
        commit([...get().paths, path]);
        set({ selectedId: path.id });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Parse error' };
      }
    },

    addManyPaths: (raws) => {
      const valid: ParsedPath[] = [];
      let base = get().paths.length;
      for (const raw of raws) {
        const t = raw.trim();
        if (!t) continue;
        try {
          valid.push(makePath(t, colorForIndex(base++)));
        } catch {
          /* skip invalid */
        }
      }
      if (valid.length) {
        commit([...get().paths, ...valid]);
        set({ selectedId: valid[0].id });
      }
    },

    removePath: (id) => {
      commit(get().paths.filter((p) => p.id !== id));
      if (get().selectedId === id) set({ selectedId: null });
    },

    clearPaths: () => {
      commit([]);
      set({ selectedId: null });
    },

    selectPath: (id) => set({ selectedId: id }),

    toggleVisible: (id) =>
      commit(get().paths.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p))),

    setColor: (id, color) =>
      set((s) => ({ paths: s.paths.map((p) => (p.id === id ? { ...p, color } : p)) })),

    translateSelected: (dx, dy) => {
      const { selectedId, paths, precision } = get();
      if (!selectedId || (dx === 0 && dy === 0)) return;
      commit(
        paths.map((p) =>
          p.id === selectedId
            ? recompute(p, translateCommands(p.parsedCommands, dx, dy), precision)
            : p,
        ),
      );
    },

    moveSelectedTo: (x, y) => {
      const { selectedId, paths, precision } = get();
      if (!selectedId) return;
      commit(
        paths.map((p) => {
          if (p.id !== selectedId) return p;
          const { commands } = moveTo(p.parsedCommands, x, y);
          return recompute(p, commands, precision);
        }),
      );
    },

    setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),
    resetViewport: () => set({ viewport: { scale: 1, tx: 80, ty: 80 } }),
    setDoc: (d) => set((s) => ({ doc: { ...s.doc, ...d } })),
    setPrecision: (p) =>
      set((s) => ({
        precision: p,
        paths: s.paths.map((path) => ({
          ...path,
          transformedPath: serializePath(path.parsedCommands, p),
        })),
      })),

    undo: () => {
      const { past, paths, future } = get();
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      set({
        paths: previous,
        past: past.slice(0, -1),
        future: [paths, ...future].slice(0, 100),
      });
    },
    redo: () => {
      const { future, paths, past } = get();
      if (future.length === 0) return;
      const next = future[0];
      set({
        paths: next,
        future: future.slice(1),
        past: [...past, paths].slice(-100),
      });
    },
    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  };
});

export type Position = Vec2;

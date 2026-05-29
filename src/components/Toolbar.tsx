import { usePathStore } from '../store/usePathStore';

export function Toolbar() {
  const undo = usePathStore((s) => s.undo);
  const redo = usePathStore((s) => s.redo);
  const past = usePathStore((s) => s.past);
  const future = usePathStore((s) => s.future);
  const resetViewport = usePathStore((s) => s.resetViewport);
  const viewport = usePathStore((s) => s.viewport);
  const setViewport = usePathStore((s) => s.setViewport);

  const zoom = (factor: number) =>
    setViewport({ scale: Math.min(50, Math.max(0.05, viewport.scale * factor)) });

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark" />
        <div>
          <h1>SVG Path Positioning Tool</h1>
          <p>parse · reposition · re-export path data</p>
        </div>
      </div>
      <div className="toolbar-actions">
        <button className="btn" onClick={undo} disabled={past.length === 0} title="Undo (⌘Z)">
          ↶ Undo
        </button>
        <button className="btn" onClick={redo} disabled={future.length === 0} title="Redo (⌘⇧Z)">
          ↷ Redo
        </button>
        <span className="divider" />
        <button className="btn" onClick={() => zoom(1 / 1.2)} title="Zoom out">
          −
        </button>
        <button className="btn" onClick={() => zoom(1.2)} title="Zoom in">
          +
        </button>
        <button className="btn" onClick={resetViewport} title="Reset view">
          Reset view
        </button>
      </div>
    </header>
  );
}

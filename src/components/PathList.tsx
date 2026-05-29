import { usePathStore } from '../store/usePathStore';

export function PathList() {
  const paths = usePathStore((s) => s.paths);
  const selectedId = usePathStore((s) => s.selectedId);
  const selectPath = usePathStore((s) => s.selectPath);
  const removePath = usePathStore((s) => s.removePath);
  const toggleVisible = usePathStore((s) => s.toggleVisible);
  const clearPaths = usePathStore((s) => s.clearPaths);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Paths ({paths.length})</h2>
        {paths.length > 0 && (
          <button className="link-btn" onClick={clearPaths}>
            clear all
          </button>
        )}
      </div>
      {paths.length === 0 ? (
        <p className="empty">No paths yet. Add one above.</p>
      ) : (
        <ul className="path-list">
          {paths.map((p, i) => (
            <li
              key={p.id}
              className={`path-item${p.id === selectedId ? ' is-selected' : ''}`}
              onClick={() => selectPath(p.id)}
            >
              <span className="swatch" style={{ background: p.color }} />
              <span className="path-name">path {i + 1}</span>
              <button
                className="icon-btn"
                title={p.visible ? 'Hide' : 'Show'}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVisible(p.id);
                }}
              >
                {p.visible ? '◉' : '◯'}
              </button>
              <button
                className="icon-btn"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  removePath(p.id);
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

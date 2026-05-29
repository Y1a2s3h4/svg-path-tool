import { usePathStore } from '../store/usePathStore';
import { usePathBBox } from '../hooks/usePathTransform';

export function AlignmentTools() {
  const selectedId = usePathStore((s) => s.selectedId);
  const paths = usePathStore((s) => s.paths);
  const selected = paths.find((p) => p.id === selectedId) ?? null;
  const doc = usePathStore((s) => s.doc);
  const setDoc = usePathStore((s) => s.setDoc);
  const moveSelectedTo = usePathStore((s) => s.moveSelectedTo);
  const bbox = usePathBBox(selected);

  const disabled = !selected || !bbox;

  const align = (kind: string) => {
    if (!bbox) return;
    let x = bbox.minX;
    let y = bbox.minY;
    switch (kind) {
      case 'left':
        x = 0;
        break;
      case 'right':
        x = doc.width - bbox.width;
        break;
      case 'top':
        y = 0;
        break;
      case 'bottom':
        y = doc.height - bbox.height;
        break;
      case 'centerH':
        x = (doc.width - bbox.width) / 2;
        break;
      case 'centerV':
        y = (doc.height - bbox.height) / 2;
        break;
      case 'center':
        x = (doc.width - bbox.width) / 2;
        y = (doc.height - bbox.height) / 2;
        break;
    }
    moveSelectedTo(x, y);
  };

  return (
    <section className="panel">
      <h2 className="panel-title">Align to canvas</h2>

      <div className="field-row">
        <label className="field">
          <span>Canvas W</span>
          <input
            type="number"
            value={doc.width}
            onChange={(e) => setDoc({ width: Math.max(1, Number(e.target.value) || 0) })}
          />
        </label>
        <label className="field">
          <span>Canvas H</span>
          <input
            type="number"
            value={doc.height}
            onChange={(e) => setDoc({ height: Math.max(1, Number(e.target.value) || 0) })}
          />
        </label>
      </div>

      <div className="align-grid">
        <button className="btn" disabled={disabled} onClick={() => align('left')}>
          Align left
        </button>
        <button className="btn" disabled={disabled} onClick={() => align('centerH')}>
          Center H
        </button>
        <button className="btn" disabled={disabled} onClick={() => align('right')}>
          Align right
        </button>
        <button className="btn" disabled={disabled} onClick={() => align('top')}>
          Align top
        </button>
        <button className="btn" disabled={disabled} onClick={() => align('centerV')}>
          Center V
        </button>
        <button className="btn" disabled={disabled} onClick={() => align('bottom')}>
          Align bottom
        </button>
      </div>
      <button className="btn btn-wide" disabled={disabled} onClick={() => align('center')}>
        Center on canvas
      </button>
    </section>
  );
}

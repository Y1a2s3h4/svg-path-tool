import { usePathStore } from '../store/usePathStore';
import { usePathTransform } from '../hooks/usePathTransform';
import { formatNumber } from '../pathOperations/serialize';

export function Inspector() {
  const selectedId = usePathStore((s) => s.selectedId);
  const paths = usePathStore((s) => s.paths);
  const selected = paths.find((p) => p.id === selectedId) ?? null;
  const { bbox, coordinateCount } = usePathTransform(selected);

  if (!selected || !bbox) {
    return (
      <section className="panel">
        <h2 className="panel-title">Inspector</h2>
        <p className="empty">Select a path to inspect it.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Inspector</h2>
      <div className="readout">
        <div className="readout-block">
          <span className="readout-label">Current position</span>
          <div className="readout-vals">
            <span>
              X <b>{formatNumber(bbox.minX, 2)}</b>
            </span>
            <span>
              Y <b>{formatNumber(bbox.minY, 2)}</b>
            </span>
          </div>
        </div>
        <div className="readout-block">
          <span className="readout-label">Size</span>
          <div className="readout-vals">
            <span>
              W <b>{formatNumber(bbox.width, 2)}</b>
            </span>
            <span>
              H <b>{formatNumber(bbox.height, 2)}</b>
            </span>
          </div>
        </div>
        <div className="readout-block">
          <span className="readout-label">Extent</span>
          <div className="readout-vals small">
            <span>
              max&nbsp;X {formatNumber(bbox.maxX, 2)}
            </span>
            <span>
              max&nbsp;Y {formatNumber(bbox.maxY, 2)}
            </span>
          </div>
        </div>
        <div className="readout-block">
          <span className="readout-label">Complexity</span>
          <div className="readout-vals small">
            <span>{selected.parsedCommands.length} commands</span>
            <span>{coordinateCount} coords</span>
          </div>
        </div>
      </div>
    </section>
  );
}

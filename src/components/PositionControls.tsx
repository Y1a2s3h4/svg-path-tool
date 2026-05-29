import { useEffect, useState } from 'react';
import { usePathStore } from '../store/usePathStore';
import { usePathBBox } from '../hooks/usePathTransform';

const NUDGES = [1, 5, 10];

export function PositionControls() {
  const selectedId = usePathStore((s) => s.selectedId);
  const paths = usePathStore((s) => s.paths);
  const selected = paths.find((p) => p.id === selectedId) ?? null;
  const moveSelectedTo = usePathStore((s) => s.moveSelectedTo);
  const translateSelected = usePathStore((s) => s.translateSelected);
  const bbox = usePathBBox(selected);

  const [nudge, setNudge] = useState(5);
  const [xVal, setXVal] = useState('');
  const [yVal, setYVal] = useState('');

  // sync local inputs whenever the underlying position changes
  useEffect(() => {
    if (bbox) {
      setXVal(String(Math.round(bbox.minX * 100) / 100));
      setYVal(String(Math.round(bbox.minY * 100) / 100));
    }
  }, [bbox?.minX, bbox?.minY]);

  if (!selected || !bbox) {
    return (
      <section className="panel">
        <h2 className="panel-title">Position</h2>
        <p className="empty">Select a path to move it.</p>
      </section>
    );
  }

  const applyX = () => {
    const x = Number.parseFloat(xVal);
    if (!Number.isNaN(x)) moveSelectedTo(x, bbox.minY);
  };
  const applyY = () => {
    const y = Number.parseFloat(yVal);
    if (!Number.isNaN(y)) moveSelectedTo(bbox.minX, y);
  };

  return (
    <section className="panel">
      <h2 className="panel-title">Position</h2>

      <div className="field-row">
        <label className="field">
          <span>X</span>
          <input
            type="number"
            value={xVal}
            onChange={(e) => setXVal(e.target.value)}
            onBlur={applyX}
            onKeyDown={(e) => e.key === 'Enter' && applyX()}
          />
        </label>
        <label className="field">
          <span>Y</span>
          <input
            type="number"
            value={yVal}
            onChange={(e) => setYVal(e.target.value)}
            onBlur={applyY}
            onKeyDown={(e) => e.key === 'Enter' && applyY()}
          />
        </label>
      </div>

      <div className="nudge-row">
        <span className="readout-label">Nudge</span>
        <div className="segmented">
          {NUDGES.map((n) => (
            <button
              key={n}
              className={`seg${nudge === n ? ' active' : ''}`}
              onClick={() => setNudge(n)}
            >
              {n}px
            </button>
          ))}
        </div>
      </div>

      <div className="dpad">
        <button className="dpad-btn up" onClick={() => translateSelected(0, -nudge)}>
          ↑
        </button>
        <button className="dpad-btn left" onClick={() => translateSelected(-nudge, 0)}>
          ←
        </button>
        <button className="dpad-btn right" onClick={() => translateSelected(nudge, 0)}>
          →
        </button>
        <button className="dpad-btn down" onClick={() => translateSelected(0, nudge)}>
          ↓
        </button>
      </div>
    </section>
  );
}

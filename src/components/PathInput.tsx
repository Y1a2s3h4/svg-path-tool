import { useState } from 'react';
import { usePathStore } from '../store/usePathStore';

const EXAMPLE = 'M -0 8.9609 V 0.0001 H 1.2329 V 3.6611 H 5.6973 V 0.0001 H 6.9297 V 8.9609 H 5.6973 V 4.7803 H 1.2329 V 8.9609 H -0 Z';

/** Pull every `d="..."` attribute out of pasted SVG markup. */
function extractPathsFromSvg(markup: string): string[] {
  const out: string[] = [];
  const re = /\sd\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup)) !== null) {
    const d = (m[2] ?? m[3] ?? '').trim();
    if (d) out.push(d);
  }
  return out;
}

export function PathInput() {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const addPath = usePathStore((s) => s.addPath);
  const addManyPaths = usePathStore((s) => s.addManyPaths);

  const handleAdd = () => {
    const text = raw.trim();
    if (!text) return;

    if (text.includes('<svg') || text.includes('<path')) {
      const ds = extractPathsFromSvg(text);
      if (ds.length === 0) {
        setError('No <path d="..."> found in the SVG markup.');
        return;
      }
      addManyPaths(ds);
      setError(null);
      setRaw('');
      return;
    }

    const res = addPath(text);
    if (!res.ok) {
      setError(res.error ?? 'Could not parse path');
    } else {
      setError(null);
      setRaw('');
    }
  };

  return (
    <section className="panel">
      <h2 className="panel-title">Input</h2>
      <textarea
        className="path-input"
        value={raw}
        spellCheck={false}
        placeholder={'Paste SVG path data\ne.g. M0 0 L50 60 …\nor paste whole <svg>…</svg> markup'}
        onChange={(e) => {
          setRaw(e.target.value);
          if (error) setError(null);
        }}
        rows={5}
      />
      {error && <p className="input-error">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" onClick={handleAdd}>
          Add path
        </button>
        <button
          className="btn"
          onClick={() => {
            setRaw(EXAMPLE);
            setError(null);
          }}
        >
          Example
        </button>
      </div>
      <p className="hint">
        Paths, full <code>&lt;svg&gt;</code> markup, and multi-path imports are all supported.
      </p>
    </section>
  );
}

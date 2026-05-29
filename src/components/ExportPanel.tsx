import { useMemo, useState } from 'react';
import { usePathStore } from '../store/usePathStore';
import { buildSvgDocument } from '../pathOperations/serialize';

type Tab = 'path' | 'svg' | 'json';

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportPanel() {
  const paths = usePathStore((s) => s.paths);
  const selectedId = usePathStore((s) => s.selectedId);
  const doc = usePathStore((s) => s.doc);
  const selected = paths.find((p) => p.id === selectedId) ?? null;

  const [tab, setTab] = useState<Tab>('path');
  const [copied, setCopied] = useState(false);

  const content = useMemo(() => {
    if (tab === 'path') {
      return selected ? selected.transformedPath : paths.map((p) => p.transformedPath).join('\n');
    }
    if (tab === 'svg') {
      return buildSvgDocument(
        paths.map((p) => ({ d: p.transformedPath, stroke: p.color })),
        doc.width,
        doc.height,
      );
    }
    return JSON.stringify(
      paths.map((p) => ({
        id: p.id,
        originalPath: p.originalPath,
        transformedPath: p.transformedPath,
        position: p.position,
        parsedCommands: p.parsedCommands,
      })),
      null,
      2,
    );
  }, [tab, selected, paths, doc.width, doc.height]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  const doDownload = () => {
    if (tab === 'path') download('path.txt', content, 'text/plain');
    else if (tab === 'svg') download('paths.svg', content, 'image/svg+xml');
    else download('paths.json', content, 'application/json');
  };

  return (
    <section className="panel">
      <h2 className="panel-title">Export</h2>
      <div className="tabs">
        {(['path', 'svg', 'json'] as Tab[]).map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'path' ? 'Path' : t === 'svg' ? 'SVG' : 'JSON'}
          </button>
        ))}
      </div>
      <textarea className="export-area" readOnly value={content} spellCheck={false} rows={7} />
      <div className="row">
        <button className="btn btn-primary" onClick={copy} disabled={!content}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        <button className="btn" onClick={doDownload} disabled={!content}>
          Download
        </button>
      </div>
    </section>
  );
}

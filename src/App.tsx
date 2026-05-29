import { useEffect } from 'react';
import { usePathStore } from './store/usePathStore';
import { Toolbar } from './components/Toolbar';
import { PathInput } from './components/PathInput';
import { PathList } from './components/PathList';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { PositionControls } from './components/PositionControls';
import { AlignmentTools } from './components/AlignmentTools';
import { ExportPanel } from './components/ExportPanel';

export default function App() {
  const undo = usePathStore((s) => s.undo);
  const redo = usePathStore((s) => s.redo);
  const translateSelected = usePathStore((s) => s.translateSelected);
  const selectedId = usePathStore((s) => s.selectedId);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (typing || !selectedId) return;

      const amount = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        translateSelected(-amount, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        translateSelected(amount, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        translateSelected(0, -amount);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        translateSelected(0, amount);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, translateSelected, selectedId]);

  return (
    <div className="app">
      <Toolbar />
      <div className="workspace">
        <aside className="sidebar sidebar-left">
          <PathInput />
          <PathList />
        </aside>
        <main className="stage">
          <Canvas />
        </main>
        <aside className="sidebar sidebar-right">
          <Inspector />
          <PositionControls />
          <AlignmentTools />
          <ExportPanel />
        </aside>
      </div>
    </div>
  );
}

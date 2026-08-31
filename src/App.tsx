// Scaffold only. The interface is built one ticket at a time against 02-design.md; this shell exists
// so `vite build` and the end-to-end runner have something real to operate on before the first
// feature lands. The `data-testid` attribute is the selector contract from
// .ai/standards/testing-standards.md, exercised here end to end before any story depends on it.
export default function App() {
  return (
    <main data-testid="app-root" className="p-8 font-sans">
      <h1 className="text-xl font-semibold">CaleChip</h1>
      <p className="text-sm opacity-70">Scaffold. No features yet.</p>
    </main>
  );
}

// src/components/DebugPanel.jsx
import React from 'react';

export default function DebugPanel({
  currentStep,
  players,
  drawData,
  matcher,
  regenerateAll,
  regenerateRound,
}) {
  const roundCount = drawData?.totalRounds ?? 0;
  const matchCount = drawData
    ? drawData.draws.reduce((sum, r) => sum + r.matches.length, 0)
    : 0;

  const hasRegenerateRound = !!(matcher && typeof matcher.regenerateRound === 'function');
  const hasUndo = !!(matcher && typeof matcher.undoLastRegeneration === 'function');
  const hasGetSummary = !!(matcher && typeof matcher.getDrawSummary === 'function');

  const url = new URL(window.location.href);
  const startCourt = drawData?.draws?.[0]?.matches?.[0]?.court ?? '—';

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <div className="bg-white border border-neutral-300 rounded-xl shadow-lg p-4 text-sm">
        <div className="font-semibold mb-2">Debug Panel</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="text-neutral-500">Step</div><div>{currentStep}</div>
          <div className="text-neutral-500">Players</div><div>{players?.length ?? 0}</div>
          <div className="text-neutral-500">Rounds</div><div>{roundCount}</div>
          <div className="text-neutral-500">Matches</div><div>{matchCount}</div>
          <div className="text-neutral-500">Start court (first)</div><div>{String(startCourt)}</div>
          <div className="text-neutral-500">Query</div><div>{url.search}</div>
          <div className="text-neutral-500">matcher.regenerateRound</div><div>{String(hasRegenerateRound)}</div>
          <div className="text-neutral-500">matcher.undoLastRegeneration</div><div>{String(hasUndo)}</div>
          <div className="text-neutral-500">matcher.getDrawSummary</div><div>{String(hasGetSummary)}</div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => regenerateAll?.()}
            className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Regenerate All
          </button>
          <button
            onClick={() => hasRegenerateRound && regenerateRound?.(1)}
            className="px-3 py-1.5 rounded bg-neutral-100 hover:bg-neutral-200"
            title="Calls matcher.regenerateRound(1) if available"
          >
            Regenerate Round 1
          </button>
        </div>

        <div className="mt-3 text-xs text-neutral-500">
          Tip: append <code>?debug=1</code> to the URL to toggle this panel.
        </div>
      </div>
    </div>
  );
}

// src/components/PartnerPairing.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Users,
  ChevronRight,
  ShieldCheck,
  Shuffle as ShuffleIcon,
  RotateCcw as ClearIcon,
} from 'lucide-react';

/**
 * Props:
 * - players: Array<{ id, name, gender, skillBracket, skillRating, lockedPartner? }>
 * - preConfirmedPairs: Array<[Player, Player]> or Array<{a: Player, b: Player}>
 * - onPairingComplete: (updatedPlayers) => void
 */
export default function PartnerPairing({ players = [], preConfirmedPairs = [], onPairingComplete }) {
  // Suggestion card: { a, b, status: 'pending' | 'confirmed' | 'rejected' }
  const [suggestions, setSuggestions] = useState([]);
  const [unpaired, setUnpaired] = useState([]);
  const [allowAutoSuggest, setAllowAutoSuggest] = useState(false); // << default OFF

  // Normalize incoming preConfirmedPairs to {a,b}
  const normalizedPreconfirmed = useMemo(() => {
    return preConfirmedPairs
      .map((p) => {
        if (Array.isArray(p) && p.length === 2) return { a: p[0], b: p[1] };
        if (p && p.a && p.b) return { a: p.a, b: p.b };
        return null;
      })
      .filter(Boolean);
  }, [preConfirmedPairs]);

  const shuffleArray = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const makeAutoSuggestions = (pool) => {
    const sorted = [...pool].sort((p1, p2) => {
      const g = (p1.gender || '').localeCompare(p2.gender || '');
      if (g !== 0) return g;
      return (p1.skillRating ?? 0) - (p2.skillRating ?? 0);
    });
    const auto = [];
    for (let i = 0; i < sorted.length; i += 2) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (a && b) auto.push({ a, b, status: 'pending' });
    }
    return auto;
  };

  // Build initial lists
  useEffect(() => {
    const pool = players.map((p) => ({ ...p }));
    const taken = new Set();
    const seenLocked = new Set();

    // 1) existing locked partner pairs (confirmed)
    const lockedPairs = [];
    for (const p of pool) {
      if (p.lockedPartner && !seenLocked.has(p.id)) {
        const mate = pool.find((x) => x.id === p.lockedPartner);
        if (mate) {
          lockedPairs.push({ a: p, b: mate, status: 'confirmed' });
          seenLocked.add(p.id);
          seenLocked.add(mate.id);
          taken.add(p.id);
          taken.add(mate.id);
        }
      }
    }

    // 2) incoming preconfirmed (confirmed)
    const preC = [];
    for (const pair of normalizedPreconfirmed) {
      const a = pool.find((x) => x.id === (pair.a.id ?? pair.a));
      const b = pool.find((x) => x.id === (pair.b.id ?? pair.b));
      if (a && b && !taken.has(a.id) && !taken.has(b.id)) {
        preC.push({ a, b, status: 'confirmed' });
        taken.add(a.id);
        taken.add(b.id);
      }
    }

    // Remaining players (unpaired)
    const remaining = pool.filter((p) => !taken.has(p.id));

    // IMPORTANT: by default DO NOT auto-suggest for singles
    const auto = allowAutoSuggest ? makeAutoSuggestions(remaining) : [];

    // Any leftover if odd after auto (or all if autos disabled)
    const pairedIds = new Set();
    auto.forEach((s) => {
      pairedIds.add(s.a.id);
      pairedIds.add(s.b.id);
    });
    const leftover = remaining.filter((p) => !pairedIds.has(p.id));

    setSuggestions([...lockedPairs, ...preC, ...auto]);
    setUnpaired(leftover);
  }, [players, normalizedPreconfirmed, allowAutoSuggest]);

  // Actions
  const confirmPair = (idx) => {
    setSuggestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], status: 'confirmed' };
      return next;
    });
  };
  const rejectPair = (idx) => {
    setSuggestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], status: 'rejected' };
      return next;
    });
  };
  const confirmAll = () => {
    setSuggestions((prev) => prev.map((s) => (s.status === 'pending' ? { ...s, status: 'confirmed' } : s)));
  };
  const handleShuffle = () => setAllowAutoSuggest((v) => !v); // toggling will rebuild autos
  const handleClearAll = () => {
    // keep only confirmed locked/preconfirmed; drop pending autos entirely
    setSuggestions((prev) => prev.filter((s) => s.status === 'confirmed'));
    setAllowAutoSuggest(false);
  };

  const handleContinue = () => {
    const updated = players.map((p) => ({ ...p }));
    for (const p of updated) delete p.lockedPartner;
    for (const s of suggestions) {
      if (s.status === 'confirmed' && s.a && s.b) {
        const a = updated.find((x) => x.id === s.a.id);
        const b = updated.find((x) => x.id === s.b.id);
        if (a && b) {
          a.lockedPartner = b.id;
          b.lockedPartner = a.id;
        }
      }
    }
    onPairingComplete?.(updated);
  };

  const pendingCount = suggestions.filter((s) => s.status === 'pending').length;
  const confirmedCount = suggestions.filter((s) => s.status === 'confirmed').length;

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Partner Pairing</h2>
          <p className="text-neutral-600">
            Confirm existing pairs. Singles remain unpaired by default. You may optionally generate suggestions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-600">Confirmed: {confirmedCount}</span>
          <span className="text-sm text-neutral-600">Pending: {pendingCount}</span>
          <span className="text-sm text-neutral-600">Unpaired: {unpaired.length}</span>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="bg-white border rounded-lg p-4 mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={confirmAll}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          disabled={pendingCount === 0}
          title={pendingCount === 0 ? 'No pending suggestions to confirm' : 'Confirm all suggested pairs'}
        >
          <ShieldCheck className="w-4 h-4" />
          Confirm All Suggested Pairs
        </button>

        <label className="flex items-center gap-2 text-sm bg-neutral-100 px-3 py-2 rounded">
          <input
            type="checkbox"
            checked={allowAutoSuggest}
            onChange={(e) => setAllowAutoSuggest(e.target.checked)}
          />
          Suggest pairs for singles (optional)
        </label>

        <button
          onClick={handleShuffle}
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-800 rounded-lg hover:bg-neutral-200 transition-colors"
          title="Toggle suggestions (and rebuild)"
        >
          <ShuffleIcon className="w-4 h-4" />
          {allowAutoSuggest ? 'Rebuild Suggestions' : 'Generate Suggestions'}
        </button>

        <button
          onClick={handleClearAll}
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-800 rounded-lg hover:bg-neutral-200 transition-colors"
          title="Remove pending suggestions and keep only confirmed"
        >
          <ClearIcon className="w-4 h-4" />
          Clear Pending Suggestions
        </button>
      </div>

      {/* Suggestion list (could be only confirmed if autos are off) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {suggestions.map((s, idx) => (
          <div
            key={`${s.a?.id}-${s.b?.id}-${idx}`}
            className={`border rounded-lg p-4 bg-white ${
              s.status === 'confirmed'
                ? 'border-green-300 bg-green-50'
                : s.status === 'rejected'
                ? 'border-red-300 bg-red-50'
                : 'border-neutral-200'
            }`}
          >
            <div className="flex items-center gap-2 text-neutral-700 font-medium mb-3">
              <Users className="w-4 h-4" />
              Pair
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="font-semibold text-neutral-900">
                  {s.a?.name} <span className="text-neutral-500 text-sm">({s.a?.skillRating})</span>
                </div>
                <div className="text-neutral-600 text-sm">
                  {s.a?.gender} • {s.a?.skillBracket}
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-neutral-400" />

              <div className="flex-1 text-right">
                <div className="font-semibold text-neutral-900">
                  {s.b?.name} <span className="text-neutral-500 text-sm">({s.b?.skillRating})</span>
                </div>
                <div className="text-neutral-600 text-sm">
                  {s.b?.gender} • {s.b?.skillBracket}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => confirmPair(idx)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded ${
                  s.status === 'confirmed'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
                title="Confirm this pair"
              >
                <CheckCircle className="w-4 h-4" />
                {s.status === 'confirmed' ? 'Confirmed' : 'Confirm'}
              </button>
              <button
                onClick={() => rejectPair(idx)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded ${
                  s.status === 'rejected'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
                title="Reject this pair"
              >
                <XCircle className="w-4 h-4" />
                {s.status === 'rejected' ? 'Rejected' : 'Reject'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Unpaired list */}
      {unpaired.length > 0 && (
        <div className="mt-8 bg-white border rounded-lg p-4">
          <div className="font-semibold text-neutral-900 mb-3">Unpaired Players ({unpaired.length})</div>
          <div className="flex flex-wrap gap-2">
            {unpaired.map((p) => (
              <span key={p.id} className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-sm">
                {p.name} ({p.skillRating})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Continue */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleContinue}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Continue to Draw
        </button>
      </div>
    </div>
  );
}

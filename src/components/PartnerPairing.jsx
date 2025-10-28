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
  Link as LinkIcon,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

/**
 * Props:
 * - players: Array<{ id, name, gender, skillBracket, skillRating, _partnerText? }>
 * - preConfirmedPairs: Array<[Player, Player]> or Array<{a: Player, b: Player}>
 * - onPairingComplete: (updatedPlayers) => void
 */
export default function PartnerPairing({ players = [], preConfirmedPairs = [], onPairingComplete }) {
  const [suggestions, setSuggestions] = useState([]); // {a,b,score,mutual,oneWay,status}
  const [unpaired, setUnpaired] = useState([]);
  const [allowAutoSuggest, setAllowAutoSuggest] = useState(false); // singles stay unpaired by default

  // Pair Builder (at bottom)
  const [builderA, setBuilderA] = useState(null);
  const [builderB, setBuilderB] = useState(null);

  // Normalize incoming preConfirmedPairs
  const normalizedPreconfirmed = useMemo(() => {
    return preConfirmedPairs
      .map((p) =>
        Array.isArray(p) && p.length === 2
          ? { a: p[0], b: p[1] }
          : p?.a && p?.b
          ? { a: p.a, b: p.b }
          : null
      )
      .filter(Boolean);
  }, [preConfirmedPairs]);

  useEffect(() => {
    const pool = players.map((p) => ({ ...p }));
    const byName = new Map(pool.map((p) => [normalizeName(p.name), p]));
    const taken = new Set();

    // 1) preconfirmed
    const confirmed = [];
    for (const pr of normalizedPreconfirmed) {
      const a = pool.find((x) => x.id === (pr.a.id ?? pr.a));
      const b = pool.find((x) => x.id === (pr.b.id ?? pr.b));
      if (a && b && !taken.has(a.id) && !taken.has(b.id)) {
        confirmed.push({ ...decoratePair(a, b, byName), status: 'confirmed' });
        taken.add(a.id);
        taken.add(b.id);
      }
    }

    // 2) suggestions from partner text
    const wantMap = new Map();
    for (const p of pool) {
      const who = (p._partnerText || '').split(/[;&]| and /i)[0]?.trim();
      if (who) wantMap.set(p.id, normalizeName(who));
    }

    const sug = [];
    for (const p of pool) {
      if (taken.has(p.id)) continue;
      const want = wantMap.get(p.id);
      if (!want) continue;
      const q = byName.get(want);
      if (!q || q === p || taken.has(q.id)) continue;
      const mutual = wantMap.get(q.id) === normalizeName(p.name);
      sug.push({ ...decoratePair(p, q, byName, mutual), status: 'pending' });
      taken.add(p.id);
      taken.add(q.id);
    }

    // 3) remaining singles
    const remaining = pool.filter((x) => !taken.has(x.id));

    // Optional auto-suggest for singles
    const auto = allowAutoSuggest ? makeAutoPairs(remaining).map((s) => ({ ...s, status: 'pending' })) : [];
    const autoTaken = new Set();
    auto.forEach((s) => {
      autoTaken.add(s.a.id);
      autoTaken.add(s.b.id);
    });

    setSuggestions([...confirmed, ...sug, ...auto]);
    setUnpaired(remaining.filter((p) => !autoTaken.has(p.id)));
    setBuilderA(null);
    setBuilderB(null);
  }, [players, normalizedPreconfirmed, allowAutoSuggest]);

  /* ---------- actions ---------- */
  const confirmAll = () => {
    setSuggestions((prev) => prev.map((s) => (s.status === 'pending' ? { ...s, status: 'confirmed' } : s)));
  };
  const confirmPair = (idx) => {
    setSuggestions((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], status: 'confirmed' };
      return n;
    });
  };
  const rejectPair = (idx) => {
    setSuggestions((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], status: 'rejected' };
      return n;
    });
  };
  const handleShuffleToggle = () => setAllowAutoSuggest((v) => !v);
  const handleClearPending = () => setSuggestions((prev) => prev.filter((s) => s.status === 'confirmed'));

  // ✅ FIX: write multiple “locked pair” flags so the matcher will respect confirmed pairs
  const handleContinue = () => {
    // Copy so we don't mutate props
    const updated = players.map((p) => ({ ...p }));

    // 1) Clear any previous pairing flags (cover all common shapes)
    for (const p of updated) {
      delete p.lockedPartner;
      delete p.locked;
      delete p.fixedPartnerId;
      delete p.partnerId;
      delete p.pairKey;
    }

    // 2) Apply confirmed pairs with multiple compatible markers
    for (const s of suggestions) {
      if (s.status !== 'confirmed' || !s.a || !s.b) continue;

      const a = updated.find((x) => x.id === s.a.id);
      const b = updated.find((x) => x.id === s.b.id);
      if (!a || !b) continue;

      // Primary flags
      a.lockedPartner = b.id;
      b.lockedPartner = a.id;

      a.locked = true;
      b.locked = true;

      a.fixedPartnerId = b.id;
      b.fixedPartnerId = a.id;

      a.partnerId = b.id;
      b.partnerId = a.id;

      // Stable shared key
      const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
      a.pairKey = key;
      b.pairKey = key;
    }

    onPairingComplete?.(updated);
  };

  /* ---------- DnD for Pair Builder ---------- */
  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId !== 'unpaired' || !['pairSlotA', 'pairSlotB'].includes(destination.droppableId)) return;
    const p = unpaired.find((x) => x.id === draggableId);
    if (!p) return;
    if (destination.droppableId === 'pairSlotA') setBuilderA(p);
    else setBuilderB(p);
  };
  const clearBuilder = () => {
    setBuilderA(null);
    setBuilderB(null);
  };
  const confirmBuilderPair = () => {
    if (!builderA || !builderB || builderA.id === builderB.id) return;
    setUnpaired((prev) => prev.filter((p) => p.id !== builderA.id && p.id !== builderB.id));
    setSuggestions((prev) => [{ ...decoratePair(builderA, builderB, null), status: 'confirmed' }, ...prev]);
    clearBuilder();
  };

  const pendingCount = suggestions.filter((s) => s.status === 'pending').length;
  const confirmedCount = suggestions.filter((s) => s.status === 'confirmed').length;

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Partner Pairing</h2>
          <p className="text-neutral-600">Confirm existing pairs. Singles remain unpaired by default.</p>
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
          onClick={handleShuffleToggle}
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-800 rounded-lg hover:bg-neutral-200 transition-colors"
        >
          <ShuffleIcon className="w-4 h-4" />
          {allowAutoSuggest ? 'Rebuild Suggestions' : 'Generate Suggestions'}
        </button>

        <button
          onClick={handleClearPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-800 rounded-lg hover:bg-neutral-200 transition-colors"
        >
          <ClearIcon className="w-4 h-4" />
          Clear Pending Suggestions
        </button>
      </div>

      {/* Suggestions grid */}
      {suggestions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {suggestions.map((s, idx) => (
            <div key={`${s.a?.id}-${s.b?.id}-${idx}`} className={`border rounded-lg p-4 ${tileColors(s.score)}`}>
              <div className="flex items-center justify-between">
                <div className="text-neutral-800 font-medium">Suggested Pair</div>
                <div className="text-xs text-neutral-700">
                  Score: <b>{s.score}</b>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-neutral-900">
                    {s.a?.name} <span className="text-neutral-500 text-sm">({s.a?.skillRating})</span>
                  </div>
                  <div className="text-neutral-600 text-sm">{s.a?.skillBracket}</div>
                </div>

                <ChevronRight className="w-5 h-5 text-neutral-400" />

                <div className="flex-1 text-right">
                  <div className="font-semibold text-neutral-900">
                    {s.b?.name} <span className="text-neutral-500 text-sm">({s.b?.skillRating})</span>
                  </div>
                  <div className="text-neutral-600 text-sm">{s.b?.skillBracket}</div>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                {s.mutual && <span className="px-2 py-0.5 text-xs rounded bg-green-600 text-white">Mutual</span>}
                {s.oneWay && !s.mutual && (
                  <span className="px-2 py-0.5 text-xs rounded bg-blue-600 text-white">One-way</span>
                )}
                {!s.mutual && !s.oneWay && (
                  <span className="px-2 py-0.5 text-xs rounded bg-neutral-200 text-neutral-700">No selection</span>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => confirmPair(idx)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded ${
                    s.status === 'confirmed'
                      ? 'bg-green-600 text-white'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  {s.status === 'confirmed' ? 'Confirmed' : 'Confirm'}
                </button>
                <button
                  onClick={() => rejectPair(idx)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded ${
                    s.status === 'rejected' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  {s.status === 'rejected' ? 'Rejected' : 'Reject'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unpaired + Pair Builder */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" />
            <div className="font-semibold">Unpaired Players ({unpaired.length})</div>
          </div>

          <Droppable droppableId="unpaired" direction="vertical">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-wrap gap-2 mb-6">
                {unpaired.map((p, idx) => (
                  <Draggable key={p.id} draggableId={p.id} index={idx}>
                    {(provided2) => (
                      <span
                        ref={provided2.innerRef}
                        {...provided2.draggableProps}
                        {...provided2.dragHandleProps}
                        className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-sm cursor-move"
                        title="Drag into Pair Builder below"
                      >
                        {p.name} ({p.skillRating})
                      </span>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Pair Builder */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <LinkIcon className="w-4 h-4" />
              <h3 className="font-semibold">Pair Builder</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              {/* Slot A */}
              <Droppable droppableId="pairSlotA" direction="vertical">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`h-20 border-2 rounded-lg flex items-center justify-center p-3 ${
                      snapshot.isDraggingOver ? 'border-primary-500' : 'border-neutral-200'
                    }`}
                  >
                    {builderA ? (
                      <div className="text-center">
                        <div className="font-semibold">{builderA.name}</div>
                        <div className="text-xs text-neutral-600">{builderA.skillBracket || '—'}</div>
                      </div>
                    ) : (
                      <div className="text-neutral-500 text-sm">Drop Player A here</div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {/* Center controls */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={confirmBuilderPair}
                  disabled={!builderA || !builderB}
                  className="px-4 py-2 bg-success-600 text-white rounded-lg disabled:opacity-50"
                >
                  Confirm Pair
                </button>
                <button onClick={clearBuilder} className="px-4 py-2 bg-neutral-100 rounded-lg">
                  Clear
                </button>
              </div>

              {/* Slot B */}
              <Droppable droppableId="pairSlotB" direction="vertical">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`h-20 border-2 rounded-lg flex items-center justify-center p-3 ${
                      snapshot.isDraggingOver ? 'border-primary-500' : 'border-neutral-200'
                    }`}
                  >
                    {builderB ? (
                      <div className="text-center">
                        <div className="font-semibold">{builderB.name}</div>
                        <div className="text-xs text-neutral-600">{builderB.skillBracket || '—'}</div>
                      </div>
                    ) : (
                      <div className="text-neutral-500 text-sm">Drop Player B here</div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        </div>
      </DragDropContext>

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

/* ---------- helpers ---------- */
const normalizeName = (n) => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');

const decoratePair = (a, b, byName, forcedMutual) => {
  const mutual =
    forcedMutual ??
    (normalizeName(a._partnerText || '') === normalizeName(b.name) &&
      normalizeName(b._partnerText || '') === normalizeName(a.name));

  const aPickedB = normalizeName(a._partnerText || '') === normalizeName(b.name);
  const bPickedA = normalizeName(b._partnerText || '') === normalizeName(a.name);
  const oneWay = (aPickedB || bPickedA) && !mutual;

  const diff = Math.abs((a.skillRating ?? 3) - (b.skillRating ?? 3));
  const skillScore = Math.max(0, 30 - diff * 15); // 0diff=30, 1.0=15, 2.0+=0
  const wantScore = mutual ? 60 : oneWay ? 30 : 0;
  const score = Math.min(100, Math.round(wantScore + skillScore));

  return { a, b, score, mutual, oneWay };
};

const tileColors = (score) => {
  if (score >= 80) return 'border-green-300 bg-green-50';
  if (score >= 60) return 'border-blue-300 bg-blue-50';
  if (score >= 40) return 'border-yellow-300 bg-yellow-50';
  return 'border-red-300 bg-red-50';
};

const makeAutoPairs = (pool) => {
  const sorted = [...pool].sort((p1, p2) => {
    const g = (p1.gender || '').localeCompare(p2.gender || '');
    if (g !== 0) return g;
    return (p1.skillRating ?? 0) - (p2.skillRating ?? 0);
  });
  const out = [];
  for (let i = 0; i < sorted.length; i += 2) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a && b) out.push(decoratePair(a, b));
  }
  return out;
};

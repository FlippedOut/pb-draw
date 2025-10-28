// src/components/DataInput.jsx
import React, { useEffect, useRef, useState, useTransition, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  Upload,
  CheckCircle,
  XCircle,
  Link as LinkIcon,
  AlertTriangle,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

/**
 * Props:
 * - onDataSubmit(players, confirmedPairs)
 * - initialPlayers?
 * - initialPreConfirmedPairs?
 *
 * Paste CSV/TSV with headers like:
 *  Attendee First Name, Attendee Last Name, Name of partner/partners - full name, I am registered to play...
 */

export default function DataInput({
  onDataSubmit,
  initialPlayers = [],
  initialPreConfirmedPairs = [],
}) {
  const [rawText, setRawText] = useState('');
  const [players, setPlayers] = useState(initialPlayers);
  // pairs: { a, b, status:'pending'|'confirmed'|'rejected', score:number, mutual:boolean, oneWay:boolean }
  const [pairs, setPairs] = useState([]);
  const [unpaired, setUnpaired] = useState([]);
  const [isPending, startTransition] = useTransition();
  const parseTimer = useRef(null);

  // Pair Builder (drag Zoe + Chris here to make them a confirmed pair)
  const [builderA, setBuilderA] = useState(null);
  const [builderB, setBuilderB] = useState(null);

  // --- Debounced parse to keep typing snappy (fixes INP spikes) ---
  useEffect(() => {
    if (parseTimer.current) clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => {
      startTransition(() => {
        const parsed = parseInput(rawText);
        const normalizedInitial = normalizePreconfirmed(initialPreConfirmedPairs, parsed.players);
        const confirmed = normalizedInitial.map((s) => decoratePair(s.a, s.b, parsed.byName));

        setPlayers(parsed.players);
        setPairs([...confirmed, ...parsed.suggested]); // suggested already decorated
        setUnpaired(parsed.unpaired);
        setBuilderA(null);
        setBuilderB(null);
      });
    }, 250);
    return () => clearTimeout(parseTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawText, initialPreConfirmedPairs]);

  // ---------- Parsing & Scoring ----------

  const normalizeName = (n) => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');

  function normalizePreconfirmed(pre, pool) {
    const byId = new Map(pool.map((p) => [p.id, p]));
    const byName = new Map(pool.map((p) => [normalizeName(p.name), p]));
    const out = [];
    for (const item of pre || []) {
      let a = item?.a ?? (Array.isArray(item) ? item[0] : null);
      let b = item?.b ?? (Array.isArray(item) ? item[1] : null);
      if (!a || !b) continue;
      if (!a.id && a.name) a = byName.get(normalizeName(a.name));
      if (!b.id && b.name) b = byName.get(normalizeName(b.name));
      if (a?.id && b?.id) out.push({ a, b });
    }
    return out;
  }

  function guessSkill(bracket) {
    const m = /(\d+(?:\.\d+)?)/.exec(bracket || '');
    if (!m) return 3.0;
    const v = parseFloat(m[1]);
    if (Number.isNaN(v)) return 3.0;
    return v;
  }

  function parseInput(text) {
    if (!text?.trim()) {
      return { players: initialPlayers, suggested: [], unpaired: initialPlayers, byName: new Map() };
    }

    const lines = text.trim().split(/\r?\n/);
    const header = lines[0].split(/\t|,/).map((h) => h.trim().toLowerCase());
    const find = (label) => header.findIndex((h) => h.includes(label));

    const firstIdx = find('attendee first name');
    const lastIdx = find('attendee last name');
    const partnerIdx = find('partner');
    const skillIdx = find('i am registered');

    const pool = [];
    const byName = new Map();

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/\t|,/);
      let name = cols[0]?.trim();
      let partnerField = '';
      let skillBracket = '';

      if (firstIdx >= 0 && lastIdx >= 0) {
        name = `${(cols[firstIdx] || '').trim()} ${(cols[lastIdx] || '').trim()}`.trim();
      }
      if (partnerIdx >= 0) partnerField = (cols[partnerIdx] || '').trim();
      if (skillIdx >= 0) skillBracket = (cols[skillIdx] || '').trim();

      if (!name) continue;
      const p = {
        id: `p_${i}_${Math.random().toString(36).slice(2)}`,
        name,
        gender: '',
        skillBracket,
        skillRating: guessSkill(skillBracket),
        _partnerText: partnerField,
      };
      pool.push(p);
      byName.set(normalizeName(name), p);
    }

    // suggested pairs based on partner text (decorate with score/mutual/oneWay)
    const taken = new Set();
    const suggestionsRaw = [];
    const wantMap = new Map(); // who each player asked for (normalized name)
    for (const p of pool) {
      const who = (p._partnerText || '').split(/[;&]| and /i)[0]?.trim();
      if (who) wantMap.set(p.id, normalizeName(who));
    }

    for (const p of pool) {
      const want = wantMap.get(p.id);
      if (!want) continue;
      const q = byName.get(want);
      if (!q || q === p) continue;
      if (taken.has(p.id) || taken.has(q.id)) continue;
      // Avoid duplicating the same logical suggestion; if mutual, we’ll mark it.
      const mutual = wantMap.get(q.id) === normalizeName(p.name);
      suggestionsRaw.push({ a: p, b: q, mutual });
      taken.add(p.id);
      taken.add(q.id);
    }

    const suggestions = suggestionsRaw.map(({ a, b, mutual }) => decoratePair(a, b, byName, mutual));

    const unpaired = pool.filter((x) => !taken.has(x.id));

    return { players: pool, suggested: suggestions, unpaired, byName };
  }

  function decoratePair(a, b, byName, forcedMutual) {
    const mutual =
      forcedMutual ??
      (normalizeName(a._partnerText || '') === normalizeName(b.name) &&
        normalizeName(b._partnerText || '') === normalizeName(a.name));

    const aPickedB = normalizeName(a._partnerText || '') === normalizeName(b.name);
    const bPickedA = normalizeName(b._partnerText || '') === normalizeName(a.name);
    const oneWay = (aPickedB || bPickedA) && !mutual;

    // Skill proximity score (0..30)
    const diff = Math.abs((a.skillRating ?? 3) - (b.skillRating ?? 3));
    const skillScore = Math.max(0, 30 - diff * 15); // 0.0 diff => 30, 1.0 diff => 15, 2.0+ => 0

    // Base weights:
    // Mutual +60, One-way +30, none +0
    const wantScore = mutual ? 60 : oneWay ? 30 : 0;

    // Cap at 100
    const score = Math.min(100, Math.round(wantScore + skillScore));

    return {
      a,
      b,
      status: 'pending',
      score,
      mutual,
      oneWay,
    };
  }

  // ---------- Actions ----------
  const confirmAll = () => {
    setPairs((prev) => prev.map((s) => (s.status === 'pending' ? { ...s, status: 'confirmed' } : s)));
  };

  const confirmOne = (idx) => {
    setPairs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], status: 'confirmed' };
      return next;
    });
  };

  const rejectOne = (idx) => {
    setPairs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], status: 'rejected' };
      return next;
    });
  };

  const handleContinue = () => {
    const confirmedPairs = pairs.filter((p) => p.status === 'confirmed').map(({ a, b }) => ({ a, b }));
    onDataSubmit(players, confirmedPairs);
  };

  // ---------- Drag & Drop: Unpaired → Builder slots ----------
  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    // Only drag FROM unpaired list into pair slots
    if (source.droppableId !== 'unpaired' || !['pairSlotA', 'pairSlotB'].includes(destination.droppableId)) return;

    const p = unpaired.find((x) => x.id === draggableId);
    if (!p) return;

    if (destination.droppableId === 'pairSlotA') {
      setBuilderA(p);
    } else {
      setBuilderB(p);
    }
  };

  const clearBuilder = () => {
    setBuilderA(null);
    setBuilderB(null);
  };

  const confirmBuilderPair = () => {
    if (!builderA || !builderB || builderA.id === builderB.id) return;

    // Remove them from unpaired
    setUnpaired((prev) => prev.filter((p) => p.id !== builderA.id && p.id !== builderB.id));
    // Add as CONFIRMED pair (decorated)
    setPairs((prev) => [{ ...decoratePair(builderA, builderB, null), status: 'confirmed' }, ...prev]);
    clearBuilder();
  };

  const pendingCount = pairs.filter((p) => p.status === 'pending').length;
  const confirmedCount = pairs.filter((p) => p.status === 'confirmed').length;

  const tileColors = (score) => {
    if (score >= 80) return 'border-green-300 bg-green-50';
    if (score >= 60) return 'border-blue-300 bg-blue-50';
    if (score >= 40) return 'border-yellow-300 bg-yellow-50';
    return 'border-red-300 bg-red-50';
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Paste box */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="w-4 h-4" />
          <h3 className="font-semibold">Paste registration data</h3>
        </div>
        <textarea
          className="w-full h-40 p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Paste CSV/TSV with headers here…"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <div className="text-xs text-neutral-500 mt-2">
          Tip: include “Attendee First Name”, “Attendee Last Name”, and “Name of partner/partners - full name”.
        </div>
      </div>

      {/* Bulk actions + summary */}
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

        <div className="text-sm text-neutral-600">
          Players: <b>{players.length}</b> • Confirmed pairs: <b>{confirmedCount}</b> • Pending suggestions:{' '}
          <b>{pendingCount}</b> • Unpaired: <b>{unpaired.length}</b>
        </div>
      </div>

      {/* Pair Builder */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <LinkIcon className="w-4 h-4" />
          <h3 className="font-semibold">Pair builder (drag 2 players from “Unpaired” below)</h3>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
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

          {/* Suggested pairs (scored & colored) */}
          {pairs.length > 0 && (
            <div className="mt-6">
              <div className="font-semibold mb-3">Suggested pairs</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pairs.map((s, i) => (
                  <div
                    key={`${s.a?.id}-${s.b?.id}-${i}`}
                    className={`border rounded-lg p-3 ${tileColors(s.score)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-neutral-900">Suggested Pair</div>
                      <div className="text-xs text-neutral-700">
                        Score: <b>{s.score}</b>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{s.a?.name}</div>
                        <div className="text-xs text-neutral-600">{s.a?.skillBracket}</div>
                      </div>
                      <div className="text-neutral-400">×</div>
                      <div className="text-right">
                        <div className="font-semibold">{s.b?.name}</div>
                        <div className="text-xs text-neutral-600">{s.b?.skillBracket}</div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      {s.mutual && (
                        <span className="px-2 py-0.5 text-xs rounded bg-green-600 text-white">Mutual</span>
                      )}
                      {s.oneWay && !s.mutual && (
                        <span className="px-2 py-0.5 text-xs rounded bg-blue-600 text-white">One-way</span>
                      )}
                      {!s.mutual && !s.oneWay && (
                        <span className="px-2 py-0.5 text-xs rounded bg-neutral-200 text-neutral-700">No selection</span>
                      )}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => confirmOne(i)}
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
                        onClick={() => rejectOne(i)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded ${
                          s.status === 'rejected'
                            ? 'bg-red-600 text-white'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        {s.status === 'rejected' ? 'Rejected' : 'Reject'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unpaired list (draggable) */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" />
              <div className="font-semibold">Unpaired Players ({unpaired.length})</div>
            </div>
            <Droppable droppableId="unpaired" direction="vertical">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-wrap gap-2">
                  {unpaired.map((p, idx) => (
                    <Draggable key={p.id} draggableId={p.id} index={idx}>
                      {(provided2) => (
                        <span
                          ref={provided2.innerRef}
                          {...provided2.draggableProps}
                          {...provided2.dragHandleProps}
                          className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-sm cursor-move"
                          title="Drag onto Pair Builder"
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
          </div>
        </DragDropContext>
      </div>

      {/* Continue */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          disabled={players.length === 0}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

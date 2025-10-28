// src/components/DataInput.jsx
import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ShieldCheck, Users, Upload, CheckCircle, XCircle } from 'lucide-react';

/**
 * Props:
 * - onDataSubmit(players, confirmedPairs)
 * - initialPlayers?
 * - initialPreConfirmedPairs?
 *
 * Input format supported:
 *  - CSV/TSV pasted with headers, including (if available):
 *    "Attendee First Name", "Attendee Last Name", "Name of partner/partners - full name", "I am registered to play in a tournament at this level:"
 *  - Otherwise it will try to split on commas and create names.
 */

export default function DataInput({
  onDataSubmit,
  initialPlayers = [],
  initialPreConfirmedPairs = [],
}) {
  const [rawText, setRawText] = useState('');
  const [players, setPlayers] = useState(initialPlayers);
  const [pairs, setPairs] = useState([]); // {a, b, status:'pending'|'confirmed'|'rejected'}
  const [unpaired, setUnpaired] = useState([]);
  const [isPending, startTransition] = useTransition();
  const parseTimer = useRef(null);

  // --- Debounced parse of textarea to reduce INP (interaction timing) ---
  useEffect(() => {
    if (parseTimer.current) clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => {
      startTransition(() => {
        const { players: p, suggestions, unpaired: u } = parseInput(rawText);
        // Apply any initially confirmed pairs
        const normalizedInitial = normalizePreconfirmed(initialPreConfirmedPairs, p);
        const confirmed = normalizedInitial.map((s) => ({ ...s, status: 'confirmed' }));
        setPlayers(p);
        setPairs([...confirmed, ...suggestions]); // suggestions start as pending
        setUnpaired(u);
      });
    }, 250); // debounce
    return () => clearTimeout(parseTimer.current);
  }, [rawText, initialPreConfirmedPairs]);

  // ---- Helpers ----
  const normalizePreconfirmed = (pre, pool) => {
    const byName = new Map(pool.map((x) => [normalizeName(x.name), x]));
    const out = [];
    for (const item of pre || []) {
      let a = item?.a ?? (Array.isArray(item) ? item[0] : null);
      let b = item?.b ?? (Array.isArray(item) ? item[1] : null);
      if (!a || !b) continue;
      // allow either {id} or {name}
      if (!a.id && a.name) a = byName.get(normalizeName(a.name));
      if (!b.id && b.name) b = byName.get(normalizeName(b.name));
      if (a?.id && b?.id) out.push({ a, b });
    }
    return out;
  };

  const normalizeName = (n) => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');

  function parseInput(text) {
    if (!text?.trim()) {
      return { players: initialPlayers, suggestions: [], unpaired: initialPlayers };
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
        gender: '', // optional
        skillBracket,
        skillRating: guessSkill(skillBracket),
        _partnerText: partnerField,
      };
      pool.push(p);
      byName.set(normalizeName(name), p);
    }

    // Suggested pairs from the “Name of partner…” column
    const suggested = [];
    const taken = new Set();
    for (const p of pool) {
      const partnerName = (p._partnerText || '').split(/[;&]| and /i)[0]?.trim(); // first name if multiple
      if (!partnerName) continue;
      const q = byName.get(normalizeName(partnerName));
      if (!q || q === p) continue;
      if (taken.has(p.id) || taken.has(q.id)) continue;
      taken.add(p.id);
      taken.add(q.id);
      suggested.push({ a: p, b: q, status: 'pending' });
    }

    const unpairedList = pool.filter((x) => !taken.has(x.id));

    return { players: pool, suggestions: suggested, unpaired: unpairedList };
  }

  function guessSkill(bracket) {
    const m = /(\d+(?:\.\d+)?)/.exec(bracket || '');
    if (!m) return 3.0;
    const v = parseFloat(m[1]);
    if (isNaN(v)) return 3.0;
    return v;
  }

  // ---- Actions ----
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
    // Build confirmed list for App -> PartnerPairing
    const confirmedPairs = pairs.filter((p) => p.status === 'confirmed').map(({ a, b }) => ({ a, b }));
    onDataSubmit(players, confirmedPairs);
  };

  const pendingCount = pairs.filter((p) => p.status === 'pending').length;
  const confirmedCount = pairs.filter((p) => p.status === 'confirmed').length;

  return (
    <div className="max-w-4xl mx-auto">
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

      {/* Suggested pairs list */}
      {pairs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {pairs.map((s, i) => (
            <div
              key={`${s.a?.id}-${s.b?.id}-${i}`}
              className={`border rounded-lg p-3 ${
                s.status === 'confirmed'
                  ? 'border-green-300 bg-green-50'
                  : s.status === 'rejected'
                  ? 'border-red-300 bg-red-50'
                  : 'border-neutral-200 bg-white'
              }`}
            >
              <div className="font-medium text-neutral-900 mb-2">Suggested Pair</div>
              <div className="flex items-center justify-between">
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
      )}

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

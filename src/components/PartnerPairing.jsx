// src/components/PartnerPairing.jsx
import React, { useMemo, useState } from 'react';

/**
 * Expected player fields (best effort; missing fields are handled gracefully):
 *  - id, name, gender, skillRating, skillBracket
 *  - lockedPartner / fixedPartnerId / partnerId  (already-locked pairs)
 *  - pairKey                                     (optional locked pair marker)
 *  - requestedPartnerId or requestedPartnerName  (preferences from intake)
 *
 * Props:
 *  - players: Player[]
 *  - preConfirmedPairs?: Array<{aId,bId}> | Array<[Player,Player]>
 *  - onPairingComplete(updatedPlayers)
 */
export default function PartnerPairing({ players, preConfirmedPairs = [], onPairingComplete }) {
  const [confirmed, setConfirmed] = useState(new Set()); // "a|b" sorted ids
  const [removed, setRemoved] = useState(new Set());     // suggestions user rejected

  const idMap = useMemo(() => new Map(players.map(p => [String(p.id), p])), [players]);
  const nameMap = useMemo(() => {
    const m = new Map();
    for (const p of players) m.set(safeName(p.name), String(p.id));
    return m;
  }, [players]);

  // Already-locked pairs from roster (pairKey OR symmetric partner pointers)
  const existingLocked = useMemo(() => detectLockedPairs(players), [players]);

  // Pre-confirmed (from previous screen, if any)
  const preConfirmedSet = useMemo(() => {
    const s = new Set();
    for (const pr of preConfirmedPairs) {
      let aId, bId;
      if (Array.isArray(pr)) { aId = pr[0]?.id; bId = pr[1]?.id; }
      else if (typeof pr === 'object') { aId = pr.aId ?? pr.a?.id; bId = pr.bId ?? pr.b?.id; }
      if (aId && bId) s.add(keyFor(aId, bId));
    }
    return s;
  }, [preConfirmedPairs]);

  // Build suggestions: mutual → one-way → skill-based. Add confidence + colour.
  const suggestions = useMemo(() => {
    const taken = new Set(); // ids reserved by suggestions as we build
    const sugg = [];

    // Reserve already locked
    for (const { aId, bId } of existingLocked) { taken.add(String(aId)); taken.add(String(bId)); }

    const prefId = (p) =>
      p.requestedPartnerId ??
      (p.requestedPartnerName ? nameMap.get(safeName(p.requestedPartnerName)) : null) ??
      null;

    // 1) Mutual
    const visited = new Set();
    for (const p of players) {
      const pid = String(p.id);
      if (taken.has(pid)) continue;
      const qid = prefId(p);
      if (!qid || taken.has(String(qid))) continue;
      const q = idMap.get(String(qid));
      if (!q || taken.has(String(q.id))) continue;
      if (visited.has(pid) || visited.has(String(q.id))) continue;
      const qPref = prefId(q);
      if (String(qPref) === pid) {
        const meta = pairMeta(p, q, 'mutual');
        sugg.push(meta);
        taken.add(pid); taken.add(String(q.id));
        visited.add(pid); visited.add(String(q.id));
      }
    }

    // 2) One-way (only if both still free)
    for (const p of players) {
      const pid = String(p.id);
      if (taken.has(pid)) continue;
      const qid = prefId(p);
      if (!qid || taken.has(String(qid))) continue;
      const q = idMap.get(String(qid));
      if (!q || taken.has(String(q.id))) continue;
      const meta = pairMeta(p, q, 'one-way');
      sugg.push(meta);
      taken.add(pid); taken.add(String(q.id));
    }

    // 3) Skill-based for remaining singles
    const remaining = players.filter(
      (p) => !taken.has(String(p.id)) && !isInAnyLocked(String(p.id), existingLocked)
    );
    remaining.sort((a, b) => (num(a.skillRating) - num(b.skillRating)));
    for (let i = 0; i < remaining.length; i += 2) {
      const a = remaining[i];
      const b = remaining[i + 1];
      if (a && b) sugg.push(pairMeta(a, b, 'skill'));
    }

    // Drop user-removed suggestions
    return sugg.filter(pr => !removed.has(keyFor(pr.aId, pr.bId)));
  }, [players, idMap, nameMap, existingLocked, removed]);

  // --- UI handlers ---
  const toggleConfirm = (aId, bId) => {
    const k = keyFor(aId, bId);
    setConfirmed((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };
  const removeSuggestion = (aId, bId) => {
    const k = keyFor(aId, bId);
    setRemoved((r) => new Set(r).add(k));
    setConfirmed((c) => { const n = new Set(c); n.delete(k); return n; });
  };
  const confirmAll = () => {
    const all = new Set(confirmed);
    for (const pr of suggestions) all.add(keyFor(pr.aId, pr.bId));
    // also add any preConfirmed we got handed
    for (const k of preConfirmedSet) all.add(k);
    setConfirmed(all);
  };

  const handleComplete = () => {
    // Build locks map from existing locked + newly confirmed + preconfirmed
    const locks = new Map(); // id -> partnerId
    for (const pr of existingLocked) {
      locks.set(String(pr.aId), String(pr.bId));
      locks.set(String(pr.bId), String(pr.aId));
    }
    const allConfirmed = new Set(confirmed);
    for (const k of preConfirmedSet) allConfirmed.add(k);
    for (const k of allConfirmed) {
      const [a, b] = k.split('|');
      locks.set(String(a), String(b));
      locks.set(String(b), String(a));
    }

    const updated = players.map(p => {
      const pid = String(p.id);
      const partnerId = locks.get(pid) ?? p.lockedPartner ?? p.fixedPartnerId ?? p.partnerId ?? null;
      return {
        ...p,
        lockedPartner: partnerId,
        fixedPartnerId: partnerId,
        partnerId: partnerId,
      };
    });

    onPairingComplete(updated);
  };

  // --- Render ---
  return (
    <div className="max-w-5xl mx-auto px-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-neutral-900">Confirm Partners</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={confirmAll}
            className="px-3 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
          >
            Confirm all suggestions
          </button>
          <button
            onClick={handleComplete}
            className="px-3 py-2 rounded bg-success-600 text-white hover:bg-success-700"
          >
            Continue to Draw
          </button>
        </div>
      </div>

      {/* Already-locked pairs */}
      {existingLocked.length > 0 && (
        <section className="mb-6">
          <h3 className="text-sm font-medium text-neutral-700 mb-2">Already locked</h3>
          <div className="grid grid-cols-1 gap-3">
            {existingLocked.map((pr, idx) => (
              <PairTile
                key={`locked-${idx}`}
                a={playersById(idMap, pr.aId)}
                b={playersById(idMap, pr.bId)}
                reason="locked"
                confidencePct={100}
                classes="bg-neutral-50 border-neutral-200"
                disabled
              />
            ))}
          </div>
        </section>
      )}

      {/* Suggestions */}
      <section>
        <h3 className="text-sm font-medium text-neutral-700 mb-2">Suggestions</h3>
        {suggestions.length === 0 ? (
          <div className="text-neutral-500 text-sm">No suggestions available.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {suggestions.map((pr, idx) => {
              const a = playersById(idMap, pr.aId);
              const b = playersById(idMap, pr.bId);
              const k = keyFor(pr.aId, pr.bId);
              const isConf = confirmed.has(k) || preConfirmedSet.has(k);

              // Colour + confidence
              let classes = 'bg-neutral-50 border-neutral-200';
              if (pr.reason === 'mutual') classes = 'bg-green-50 border-green-200';
              else if (pr.reason === 'one-way') classes = 'bg-amber-50 border-amber-200';
              const pctText = `${Math.round(pr.confidencePct)}%`;

              return (
                <PairTile
                  key={`sugg-${idx}`}
                  a={a}
                  b={b}
                  reason={pr.reason}
                  confidencePct={pr.confidencePct}
                  pctText={pctText}
                  classes={classes}
                  checked={isConf}
                  onToggle={() => toggleConfirm(pr.aId, pr.bId)}
                  onRemove={() => removeSuggestion(pr.aId, pr.bId)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- helpers & UI bits ---------------- */

function PairTile({
  a, b, reason, confidencePct, pctText,
  classes, disabled = false, checked = false, onToggle, onRemove
}) {
  if (!a || !b) return null;

  const reasonText =
    reason === 'mutual' ? 'Mutual' :
    reason === 'one-way' ? 'One-way' :
    reason === 'locked' ? 'Locked' : 'Skill';

  const confText =
    reason === 'mutual' ? 'high confidence' :
    reason === 'one-way' ? 'medium confidence' :
    (confidencePct >= 60 ? 'medium confidence' : 'low confidence');

  return (
    <div className={`border rounded-lg px-5 py-4 ${classes}`}>
      <div className="flex items-center justify-between">
        <div className="text-neutral-900 font-medium">
          {a.name} &amp; {b.name}
          <span className="ml-3 text-xs text-neutral-500">{reasonText}</span>
          <span className="ml-2 text-xs text-neutral-500">{confText}{pctText ? ` • ${pctText}` : ''}</span>
        </div>
        {!disabled && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-neutral-700 flex items-center gap-2">
              <input type="checkbox" checked={checked} onChange={onToggle} />
              Confirm
            </label>
            <button
              onClick={onRemove}
              className="text-neutral-500 hover:text-red-600 text-sm"
              title="Remove this suggestion"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <div className="mt-2 text-sm text-neutral-600">
        Skill: {rangeText(a.skillBracket)}{a.skillBracket && b.skillBracket ? ' | ' : ''}
        {b.skillBracket ? `Skill: ${rangeText(b.skillBracket)}` : ''}
        {(a.gender || b.gender) && (
          <span className="ml-2">
            | Genders: {a.gender || '-'} &amp; {b.gender || '-'}
          </span>
        )}
      </div>
    </div>
  );
}

function playersById(idMap, id) {
  return idMap.get(String(id));
}
function keyFor(aId, bId) {
  const A = String(aId), B = String(bId);
  return A < B ? `${A}|${B}` : `${B}|${A}`;
}
function safeName(s) { return String(s || '').trim().toLowerCase(); }
function num(n) { const v = Number(n); return Number.isFinite(v) ? v : 0; }
function rangeText(r) { return String(r ?? '-'); }

function isInAnyLocked(id, lockedList) {
  for (const pr of lockedList) {
    if (String(pr.aId) === String(id) || String(pr.bId) === String(id)) return true;
  }
  return false;
}

/** detect locked pairs in roster */
function detectLockedPairs(players) {
  const out = [];
  const seen = new Set();
  const idMap = new Map(players.map(p => [String(p.id), p]));

  // pairKey route
  const byPairKey = new Map();
  for (const p of players) {
    const key = p.pairKey && String(p.pairKey).trim();
    if (!key) continue;
    if (!byPairKey.has(key)) byPairKey.set(key, []);
    byPairKey.get(key).push(p);
  }
  for (const arr of byPairKey.values()) {
    if (arr.length === 2) {
      const [a,b] = arr;
      out.push({ aId: String(a.id), bId: String(b.id), reason: 'pairKey' });
      seen.add(String(a.id)); seen.add(String(b.id));
    }
  }

  // symmetric partner pointers
  const partnerOf = (p) => p.lockedPartner ?? p.fixedPartnerId ?? p.partnerId ?? null;
  for (const p of players) {
    const pid = String(p.id);
    if (seen.has(pid)) continue;
    const qid = partnerOf(p);
    if (!qid || seen.has(String(qid))) continue;
    const q = idMap.get(String(qid));
    if (!q) continue;
    const back = partnerOf(q);
    if (back && String(back) !== pid) continue;
    out.push({ aId: pid, bId: String(q.id), reason: 'partnerId' });
    seen.add(pid); seen.add(String(q.id));
  }
  return out;
}

/** build pair metadata with confidence */
function pairMeta(a, b, reason) {
  const [sa, sb] = [num(a.skillRating), num(b.skillRating)];
  const gap = Math.abs(sa - sb);

  let pct = 60; // base
  if (reason === 'mutual') pct = 95;
  else if (reason === 'one-way') pct = 80;
  else {
    // skill-based: scale down with gap (0 → 70, 0.5 → 60, 1.0 → 50, 1.5 → 45, 2.0+ → 40)
    pct = Math.max(40, Math.min(70, 70 - (gap * 20)));
  }

  return {
    aId: String(a.id),
    bId: String(b.id),
    reason,
    confidencePct: pct,
  };
}

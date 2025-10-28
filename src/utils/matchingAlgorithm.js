// src/utils/matchingAlgorithm.js

/**
 * TournamentMatcher with fair bye rotation:
 * Priority order per round when selecting byes:
 *   1) Singles with 0 byes
 *   2) Pairs (locked partners) with 0 byes
 *   3) Singles with 1 bye
 *   4) Pairs with 1 bye
 *   ... (continue increasing bye counts; singles first at each tier)
 *
 * Notes:
 * - "Singles" = players not in a locked pair (no pairKey and no partner pointer).
 * - "Pairs"   = locked partners (by pairKey or symmetric partnerId/fixedPartnerId/lockedPartner).
 * - Pairs are indivisible: if one is on bye, both are on bye.
 * - We maintain bye counts across rounds and adjust them on regenerate/undo.
 */

export class TournamentMatcher {
  constructor(players, courts = 8, toScore = 11, options = {}) {
    this.players = Array.isArray(players) ? players : [];
    this.courts = Number(options.courts ?? courts ?? 8);
    this.toScore = Number(options.toScore ?? toScore ?? 11);
    this.startCourt = Number(options.startCourt ?? 1);
    this.rounds = options.rounds; // optional override
    this.options = options || {};

    this.history = [];            // [{ round, matches, byes }]
    this.byeCounts = new Map();   // playerId -> count
    for (const p of this.players) this.byeCounts.set(p.id, 0);
  }

  // ---------- Public API ----------

  generateDraw() {
    const totalPlayers = this.players.length;
    const totalRounds = Number.isFinite(this.rounds) ? this.rounds : 1; // default: 1

    const draws = [];
    for (let r = 1; r <= totalRounds; r++) {
      const round = this.generateRound(r);
      draws.push(round);
    }

    return {
      totalPlayers,
      totalRounds,
      draws,
      canUndo: this.history.length > 0,
    };
  }

  generateRound(roundNumber) {
    // If regenerating an existing round index, roll back its previous byes first
    const prior = this.history[roundNumber - 1];
    if (prior) this._decrementByes(prior.byes);

    // 1) Partition into locked pairs and singles (based on current roster)
    const { pairs, singles } = this._detectPairsAndSingles(this.players);

    // 2) Decide how many players can play this round
    const capacityPlayers = Math.max(0, Math.floor(this.courts) * 4);
    const totalPlayers = this.players.length;

    // If capacity fits all, no byes; otherwise choose byes by the priority rules
    let byes = [];
    if (capacityPlayers < totalPlayers) {
      const needByes = totalPlayers - capacityPlayers;
      byes = this._selectByes(needByes, pairs, singles);
    }

    // 3) Build the "playing pool" (exclude byes)
    const byeIds = new Set(byes.map((p) => p.id));
    const playing = this.players.filter((p) => !byeIds.has(p.id));

    // 4) Within playing pool, rebuild locked pairs & singles (some pairs might be fully on-bye)
    const { pairs: playingPairs, singles: playingSingles } = this._detectPairsAndSingles(playing);

    // 5) Build teams: locked pairs first, then pair remaining singles by closest skill
    const teams = [];
    for (const pr of playingPairs) teams.push({ players: [pr.a, pr.b], locked: true });

    const sortedSingles = [...playingSingles].sort(
      (a, b) => (a.skillRating ?? 0) - (b.skillRating ?? 0)
    );
    for (let i = 0; i < sortedSingles.length; i += 2) {
      const a = sortedSingles[i];
      const b = sortedSingles[i + 1];
      if (a && b) teams.push({ players: [a, b], locked: false });
      // if odd single remains, they should have been assigned bye by _selectByes
      // (so in normal conditions, we won't end up here with an unpaired single)
    }

    // 6) Shuffle teams to vary matchups, then allocate matches up to court capacity
    const shuffledTeams = shuffleArray(teams);
    const matches = [];
    const startingCourt = Math.max(1, Math.floor(this.startCourt));
    const maxMatches = Math.max(0, Math.floor(this.courts));

    let idx = 0;
    for (let m = 0; m < maxMatches; m++) {
      const t1 = shuffledTeams[idx++];
      const t2 = shuffledTeams[idx++];
      if (!t1 || !t2) break;
      const court = startingCourt + m;
      matches.push({
        id: `round${roundNumber}-court${court}`,
        court,
        team1: t1.players,
        team2: t2.players,
      });
    }

    // Any extra teams that couldn't fit into matches should go to byes (all their members),
    // but this should be rare because we sized byes first to hit capacity.
    for (; idx < shuffledTeams.length; idx++) {
      const t = shuffledTeams[idx];
      if (t?.players?.length) byes.push(...t.players);
    }

    // 7) Update bye counts and record round
    this._incrementByes(byes);
    const roundData = { round: roundNumber, matches, byes };
    this.history[roundNumber - 1] = roundData;
    return roundData;
  }

  regenerateRound(roundNumber) {
    if (!Number.isFinite(roundNumber) || roundNumber < 1) return null;
    return this.generateRound(roundNumber);
  }

  undoLastRegeneration() {
    const last = this.history.pop();
    if (!last) return false;
    this._decrementByes(last.byes);
    return true;
  }

  getDrawSummary() {
    return {
      totalPlayers: this.players.length,
      totalRounds: this.history.length,
      draws: this.history,
      canUndo: this.history.length > 0,
    };
  }

  // ---------- Bye logic & helpers ----------

  _incrementByes(players) {
    for (const p of players) {
      this.byeCounts.set(p.id, (this.byeCounts.get(p.id) ?? 0) + 1);
    }
  }
  _decrementByes(players) {
    for (const p of players) {
      const cur = this.byeCounts.get(p.id) ?? 0;
      this.byeCounts.set(p.id, Math.max(0, cur - 1));
    }
  }

  /**
   * Detect locked pairs and singles from a pool of players.
   * A pair is detected by:
   *  - pairKey shared by exactly two players, OR
   *  - symmetric partner pointers (lockedPartner/fixedPartnerId/partnerId)
   * Returns { pairs: [{a,b}], singles: [p...] }
   */
  _detectPairsAndSingles(pool) {
    const idMap = new Map(pool.map((p) => [p.id, p]));
    const taken = new Set();
    const pairs = [];
    const byPairKey = new Map();

    // a) pairKey route
    for (const p of pool) {
      const key = p.pairKey && String(p.pairKey).trim();
      if (!key) continue;
      if (!byPairKey.has(key)) byPairKey.set(key, []);
      byPairKey.get(key).push(p);
    }
    for (const [_, arr] of byPairKey.entries()) {
      if (arr.length !== 2) continue;
      const [a, b] = arr;
      if (taken.has(a.id) || taken.has(b.id)) continue;
      pairs.push({ a, b });
      taken.add(a.id);
      taken.add(b.id);
    }

    // b) symmetric partner pointer route
    const partnerOf = (p) => p?.lockedPartner ?? p?.fixedPartnerId ?? p?.partnerId ?? null;
    for (const p of pool) {
      if (taken.has(p.id)) continue;
      const pid = partnerOf(p);
      if (!pid) continue;
      const q = idMap.get(pid);
      if (!q || taken.has(q.id)) continue;
      const back = partnerOf(q);
      if (back && back !== p.id) continue; // require symmetry if provided
      pairs.push({ a: p, b: q });
      taken.add(p.id);
      taken.add(q.id);
    }

    const singles = pool.filter((p) => !taken.has(p.id));
    return { pairs, singles };
  }

  /**
   * Select exactly `needByes` players to rest this round, following the priority:
   *   singles(bye=0) -> pairs(bye=0) -> singles(bye=1) -> pairs(bye=1) -> ...
   * If we can't hit the number exactly with pairs (since they come in 2s),
   * we bias toward singles to hit the exact count. If impossible (edge case),
   * we may overshoot by 1 when only pairs are left; this will reduce active players accordingly.
   */
  _selectByes(needByes, pairs, singles) {
    if (needByes <= 0) return [];

    // Build lookup
    const getBye = (p) => this.byeCounts.get(p.id) ?? 0;

    // Sort singles by bye count asc, then by skill to keep some stability
    const singlesByCount = [...singles].sort((a, b) => {
      const c = getBye(a) - getBye(b);
      if (c !== 0) return c;
      return (a.skillRating ?? 0) - (b.skillRating ?? 0);
    });

    // For pairs, use the pair's bye "level" as the max of its two members
    const pairsByCount = [...pairs].sort((pa, pb) => {
      const aCount = Math.max(getBye(pa.a), getBye(pa.b));
      const bCount = Math.max(getBye(pb.a), getBye(pb.b));
      if (aCount !== bCount) return aCount - bCount;
      // secondary sort to make it stable
      const aSkill = ((pa.a.skillRating ?? 0) + (pa.b.skillRating ?? 0)) / 2;
      const bSkill = ((pb.a.skillRating ?? 0) + (pb.b.skillRating ?? 0)) / 2;
      return aSkill - bSkill;
    });

    // Group by count for tiered rotation
    const groupSingles = groupBy(singlesByCount, (p) => getBye(p));
    const groupPairs = groupBy(pairsByCount, (pr) => Math.max(getBye(pr.a), getBye(pr.b)));

    // Walk tiers: singles at level N, then pairs at level N, then N+1, ...
    const out = [];
    let tier = 0;

    // Find the minimum present tier so we start at the lowest seen
    const minSingleTier = minKey(groupSingles, 0);
    const minPairTier = minKey(groupPairs, 0);
    tier = Math.min(minSingleTier, minPairTier);

    while (out.length < needByes && (groupHasKeys(groupSingles) || groupHasKeys(groupPairs))) {
      // 1) singles at this tier
      const sList = groupSingles.get(tier) || [];
      while (sList.length && out.length < needByes) {
        out.push(sList.shift());
      }

      // 2) pairs at this tier (add both, counts as 2)
      const pList = groupPairs.get(tier) || [];
      while (pList.length && out.length < needByes) {
        const pr = pList.shift();
        // if only 1 needed but pairs consume 2: try to see if any singles left at higher tiers
        if (out.length === needByes - 1) {
          // Look ahead for any single in any higher tier
          const nextSingle = findNextAvailableSingle(groupSingles, tier + 1);
          if (nextSingle) {
            out.push(nextSingle);
            break; // filled exact need
          }
          // else accept overshoot by 1 (rare edge case)
        }
        out.push(pr.a, pr.b);
      }

      tier += 1;
    }

    // If we still didn't reach needByes (e.g., too few players in groups), grab from next tiers
    // Prefer singles first, then pairs, regardless of tier at this point
    if (out.length < needByes) {
      const singlesRest = flattenGroups(groupSingles);
      const pairsRest = flattenGroups(groupPairs).flatMap((pr) => [pr.a, pr.b]);
      for (const p of singlesRest) {
        if (out.length >= needByes) break;
        out.push(p);
      }
      for (let i = 0; i < pairsRest.length && out.length < needByes; i += 2) {
        const a = pairsRest[i];
        const b = pairsRest[i + 1];
        if (!a || !b) break;
        if (out.length === needByes - 1) {
          // odd one short; no single left -> accept overshoot
        }
        out.push(a, b);
      }
    }

    // Deduplicate in case of odd edgepaths
    const seen = new Set();
    const dedup = [];
    for (const p of out) {
      if (!p) continue;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      dedup.push(p);
      if (dedup.length >= needByes) break;
    }

    return dedup;
  }
}

// ---------- utilities ----------

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function groupBy(list, keyFn) {
  const m = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

function flattenGroups(groupMap) {
  const out = [];
  const keys = [...groupMap.keys()].sort((a, b) => a - b);
  for (const k of keys) out.push(...(groupMap.get(k) || []));
  return out;
}

function minKey(groupMap, fallback) {
  if (!groupMap || groupMap.size === 0) return fallback;
  return Math.min(...groupMap.keys());
}

function groupHasKeys(groupMap) {
  if (!groupMap || groupMap.size === 0) return false;
  for (const [_, arr] of groupMap.entries()) if (arr && arr.length) return true;
  return false;
}

function findNextAvailableSingle(groupSingles, startTier) {
  const keys = [...groupSingles.keys()].filter((k) => k >= startTier).sort((a, b) => a - b);
  for (const k of keys) {
    const l = groupSingles.get(k) || [];
    if (l.length) return l.shift();
  }
  return null;
}

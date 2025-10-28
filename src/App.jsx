// src/utils/matchingAlgorithm.js

/**
 * TournamentMatcher with fair bye rotation + partial flexibility for pairs.
 *
 * Bye priority each round:
 *   1) Singles with 0 byes
 *   2) Pairs (locked partners) with 0 byes
 *   3) Singles with 1 bye
 *   4) Pairs with 1 bye
 *   ... (continue increasing bye counts; singles first at each tier)
 *
 * Partial flexibility:
 * - When selecting a pair at some tier:
 *   - If >= 2 bye slots remain, take BOTH partners (preferred).
 *   - If only 1 slot remains, try to find a single at current/higher tiers.
 *     If none exist, take ONE partner from the pair (so the other can still play).
 *
 * Pair memory:
 * - We maintain a persistent pairMap from the roster so that when both partners
 *   are active in a round, they are reunited automatically.
 * - If one partner is on a bye, the other is free to be paired as a single.
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

    // Persistent pair memory (id -> partnerId), derived from initial roster
    this.pairMap = this._buildPairMap(this.players);
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
    // If regenerating an existing round, roll back its byes first
    const prior = this.history[roundNumber - 1];
    if (prior) this._decrementByes(prior.byes);

    // Current roster partition (for bye selection)
    const { pairs, singles } = this._detectPairsAndSinglesFromPairMap(this.players, this.pairMap);

    const capacityPlayers = Math.max(0, Math.floor(this.courts) * 4);
    const totalPlayers = this.players.length;

    // Choose byes by the rotation rules (with partial flexibility)
    let byes = [];
    if (capacityPlayers < totalPlayers) {
      const needByes = totalPlayers - capacityPlayers;
      byes = this._selectByesPartialFlexible(needByes, pairs, singles);
    }

    // Build the playing pool
    const byeIds = new Set(byes.map((p) => p.id));
    const playing = this.players.filter((p) => !byeIds.has(p.id));

    // Recreate locked pairs among *playing* players (using persistent pairMap),
    // everyone else is treated as single for this round
    const { pairs: playingPairs, singles: playingSingles } =
      this._detectPairsAndSinglesFromPairMap(playing, this.pairMap);

    // Build teams: all playing locked pairs first, then pair remaining singles by closest skill
    const teams = [];
    for (const pr of playingPairs) teams.push({ players: [pr.a, pr.b], locked: true });

    const sortedSingles = [...playingSingles].sort(
      (a, b) => (a.skillRating ?? 0) - (b.skillRating ?? 0)
    );
    for (let i = 0; i < sortedSingles.length; i += 2) {
      const a = sortedSingles[i];
      const b = sortedSingles[i + 1];
      if (a && b) teams.push({ players: [a, b], locked: false });
      // if odd one remains, they should have been assigned a bye already
    }

    // Allocate matches up to court capacity
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

    // Any extra teams that didn't fit (rare) become byes (all members)
    for (; idx < shuffledTeams.length; idx++) {
      const t = shuffledTeams[idx];
      if (t?.players?.length) byes.push(...t.players);
    }

    // Update bye counts and record round
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
   * Build persistent pairMap from a roster (pairKey or symmetric partner pointers).
   * pairMap: Map<playerId, partnerId>
   */
  _buildPairMap(pool) {
    const map = new Map();
    const idMap = new Map(pool.map((p) => [p.id, p]));
    const taken = new Set();
    const byPairKey = new Map();

    // a) pairKey route
    for (const p of pool) {
      const key = p.pairKey && String(p.pairKey).trim();
      if (!key) continue;
      if (!byPairKey.has(key)) byPairKey.set(key, []);
      byPairKey.get(key).push(p);
    }
    for (const arr of byPairKey.values()) {
      if (arr.length !== 2) continue;
      const [a, b] = arr;
      if (taken.has(a.id) || taken.has(b.id)) continue;
      map.set(a.id, b.id);
      map.set(b.id, a.id);
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
      map.set(p.id, q.id);
      map.set(q.id, p.id);
      taken.add(p.id);
      taken.add(q.id);
    }

    return map;
  }

  /**
   * Partition a pool into pairs & singles using a given pairMap.
   * Returns { pairs: [{a,b}], singles: [p...] }
   */
  _detectPairsAndSinglesFromPairMap(pool, pairMap) {
    const idMap = new Map(pool.map((p) => [p.id, p]));
    const seen = new Set();
    const pairs = [];
    const singles = [];

    for (const p of pool) {
      if (seen.has(p.id)) continue;
      const partnerId = pairMap.get(p.id);
      if (partnerId && idMap.has(partnerId)) {
        const q = idMap.get(partnerId);
        if (!seen.has(q.id)) {
          pairs.push({ a: p, b: q });
          seen.add(p.id);
          seen.add(q.id);
          continue;
        }
      }
      singles.push(p);
      seen.add(p.id);
    }

    return { pairs, singles };
  }

  /**
   * Select exactly `needByes` players for bye, following rotation:
   * singles(0) -> pairs(0) -> singles(1) -> pairs(1) -> ...
   * Partial flexibility for pairs:
   * - If >= 2 slots remaining: take both partners together.
   * - If only 1 slot: prefer a single; if none across all tiers, take one partner from a pair.
   */
  _selectByesPartialFlexible(needByes, pairs, singles) {
    if (needByes <= 0) return [];

    const getBye = (p) => this.byeCounts.get(p.id) ?? 0;

    // Sort singles by (byeCount asc, skill asc)
    const singlesByCount = [...singles].sort((a, b) => {
      const c = getBye(a) - getBye(b);
      if (c !== 0) return c;
      return (a.skillRating ?? 0) - (b.skillRating ?? 0);
    });

    // Sort pairs by pair-level (max of two byes), then avg skill
    const pairsByCount = [...pairs].sort((pa, pb) => {
      const aCount = Math.max(getBye(pa.a), getBye(pa.b));
      const bCount = Math.max(getBye(pb.a), getBye(pb.b));
      if (aCount !== bCount) return aCount - bCount;
      const aSkill = ((pa.a.skillRating ?? 0) + (pa.b.skillRating ?? 0)) / 2;
      const bSkill = ((pb.a.skillRating ?? 0) + (pb.b.skillRating ?? 0)) / 2;
      return aSkill - bSkill;
    });

    const groupSingles = groupBy(singlesByCount, (p) => getBye(p));
    const groupPairs = groupBy(pairsByCount, (pr) => Math.max(getBye(pr.a), getBye(pr.b)));

    const out = [];
    let remaining = needByes;

    // Start at the lowest tier present
    let tier = Math.min(
      groupSingles.size ? Math.min(...groupSingles.keys()) : Infinity,
      groupPairs.size ? Math.min(...groupPairs.keys()) : Infinity
    );
    if (!Number.isFinite(tier)) tier = 0;

    // Walk tiers until we satisfy needByes or no candidates left
    while (remaining > 0 && (groupHasValues(groupSingles) || groupHasValues(groupPairs))) {
      // 1) Singles at this tier
      const sList = groupSingles.get(tier) || [];
      while (remaining > 0 && sList.length) {
        out.push(sList.shift());
        remaining -= 1;
      }

      if (remaining <= 0) break;

      // 2) Pairs at this tier
      const pList = groupPairs.get(tier) || [];
      while (pList.length && remaining > 0) {
        const pr = pList[0]; // peek
        if (remaining >= 2) {
          // take both partners together
          pList.shift();
          out.push(pr.a, pr.b);
          remaining -= 2;
        } else {
          // remaining === 1
          // try to find any single at current or higher tiers
          const fallbackSingle = findNextAvailableSingle(groupSingles, tier);
          if (fallbackSingle) {
            out.push(fallbackSingle);
            remaining -= 1;
            break; // filled exactly
          }
          // If no single anywhere, take ONE partner from the pair (partial flexibility)
          pList.shift();
          // choose partner with higher bye deficit (i.e., lower current bye count)
          const aBye = getBye(pr.a);
          const bBye = getBye(pr.b);
          const chosen = aBye <= bBye ? pr.a : pr.b;
          out.push(chosen);
          remaining -= 1;
          break;
        }
      }

      tier += 1;
    }

    // If still short (very edge cases), pull remaining singles from higher tiers, then pairs (one by one)
    if (remaining > 0) {
      // singles anywhere
      const sRest = flattenGroups(groupSingles);
      for (const s of sRest) {
        if (remaining <= 0) break;
        out.push(s);
        remaining -= 1;
      }
    }
    if (remaining > 0) {
      // pairs anywhere; prefer taking both if we can, else one
      const pRest = flattenGroups(groupPairs);
      for (const pr of pRest) {
        if (remaining <= 0) break;
        if (remaining >= 2) {
          out.push(pr.a, pr.b);
          remaining -= 2;
        } else {
          const aBye = getBye(pr.a);
          const bBye = getBye(pr.b);
          const chosen = aBye <= bBye ? pr.a : pr.b;
          out.push(chosen);
          remaining -= 1;
          break;
        }
      }
    }

    // Deduplicate and trim (safety)
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

function groupHasValues(groupMap) {
  if (!groupMap || groupMap.size === 0) return false;
  for (const arr of groupMap.values()) if (arr && arr.length) return true;
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

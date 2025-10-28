// src/utils/matchingAlgorithm.js

/**
 * TournamentMatcher
 * - Respects locked pairs from UI (any of: lockedPartner, fixedPartnerId, partnerId, pairKey)
 * - Options:
 *    - courts:       number of courts to schedule (default 8)
 *    - startCourt:   court number to start from (default 1)
 *    - rounds:       fixed number of rounds to generate (default: heuristic)
 *    - toScore:      points per game (carried through; not used in layout)
 */
export class TournamentMatcher {
  constructor(players, courts = 8, toScore = 11, options = {}) {
    this.players = Array.isArray(players) ? players : [];
    this.courts = Number(options.courts ?? courts ?? 8);
    this.toScore = Number(options.toScore ?? toScore ?? 11);
    this.startCourt = Number(options.startCourt ?? 1);
    this.rounds = options.rounds; // optional override
    this.options = options || {};

    // internal
    this.history = [];
  }

  // ---------- Public API ----------

  generateDraw() {
    const totalPlayers = this.players.length;
    const effectiveCourts = Math.max(0, Number(this.courts) || 0);

    // Heuristic: how many full 4-player matches can we host per round?
    // If rounds not specified, make ~2 rounds per block of courts.
    const defaultRounds = Math.max(
      1,
      Math.ceil(totalPlayers / Math.max(1, effectiveCourts * 4)) * 2
    );
    const totalRounds = Number.isFinite(this.rounds) ? this.rounds : defaultRounds;

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
    // 1) Build teams: keep locked pairs together; pair remaining by closest skill
    const { teams, singlesLeftover } = this._buildTeams();

    // 2) Shuffle teams to vary opponents each round
    const shuffledTeams = shuffleArray(teams);

    // 3) Allocate matches up to the number of courts
    const matches = [];
    const byes = [];

    const maxMatches = Math.max(0, Math.floor(this.courts));
    const startingCourt = Math.max(1, Math.floor(this.startCourt));

    let teamIdx = 0;
    for (let m = 0; m < maxMatches; m++) {
      const t1 = shuffledTeams[teamIdx++];
      const t2 = shuffledTeams[teamIdx++];
      if (!t1 || !t2) break; // not enough teams for another match

      const court = startingCourt + m;
      matches.push({
        id: `round${roundNumber}-court${court}`,
        court,
        team1: t1.players,
        team2: t2.players,
      });
    }

    // 4) Anything left becomes byes (leftover teams’ players + any single that couldn’t be paired)
    // leftover full teams:
    for (; teamIdx < shuffledTeams.length; teamIdx++) {
      const t = shuffledTeams[teamIdx];
      if (t?.players?.length) byes.push(...t.players);
    }
    // leftover single (if odd count when pairing):
    if (singlesLeftover?.length) byes.push(...singlesLeftover);

    const roundData = { round: roundNumber, matches, byes };
    this.history[roundNumber - 1] = roundData; // replace if regenerating
    return roundData;
  }

  regenerateRound(roundNumber) {
    if (!Number.isFinite(roundNumber) || roundNumber < 1) return null;
    return this.generateRound(roundNumber);
  }

  undoLastRegeneration() {
    if (this.history.length === 0) return false;
    this.history.pop();
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

  // ---------- Internal helpers ----------

  /**
   * Build teams for the round:
   *  - Locked pairs stay together
   *  - Remaining players are paired greedily by closest skillRating
   * Returns { teams: Array<{players:[a,b]}> , singlesLeftover: [p?] }
   */
  _buildTeams() {
    const players = this.players.map((p) => ({ ...p }));
    const idMap = new Map(players.map((p) => [p.id, p]));

    // 1) Detect locked pairs by multiple flags
    const taken = new Set();
    const pairKeyMap = new Map(); // pairKey => [a,b]
    const teams = [];

    // a) PairKey path
    for (const p of players) {
      const key = p.pairKey && String(p.pairKey).trim();
      if (!key) continue;
      if (!pairKeyMap.has(key)) pairKeyMap.set(key, []);
      pairKeyMap.get(key).push(p);
    }
    for (const [key, arr] of pairKeyMap.entries()) {
      if (arr.length !== 2) continue;
      const [a, b] = arr;
      if (taken.has(a.id) || taken.has(b.id)) continue;
      teams.push({ players: [a, b], locked: true });
      taken.add(a.id);
      taken.add(b.id);
    }

    // b) Symmetric pointer path (lockedPartner / fixedPartnerId / partnerId)
    const partnerOf = (p) => p?.lockedPartner ?? p?.fixedPartnerId ?? p?.partnerId ?? null;
    for (const p of players) {
      if (taken.has(p.id)) continue;
      const pid = partnerOf(p);
      if (!pid) continue;
      const q = idMap.get(pid);
      if (!q || taken.has(q.id)) continue;
      // require symmetric link if present
      const back = partnerOf(q);
      if (back && back !== p.id) continue;
      teams.push({ players: [p, q], locked: true });
      taken.add(p.id);
      taken.add(q.id);
    }

    // 2) Remaining pool to be paired by closest skill
    const remaining = players.filter((p) => !taken.has(p.id));
    remaining.sort((a, b) => (a.skillRating ?? 0) - (b.skillRating ?? 0));

    // Greedy nearest-neighbour pairing by skill
    const singlesLeftover = [];
    for (let i = 0; i < remaining.length; i += 2) {
      const a = remaining[i];
      const b = remaining[i + 1];
      if (a && b) {
        teams.push({ players: [a, b], locked: false });
      } else if (a && !b) {
        singlesLeftover.push(a);
      }
    }

    return { teams, singlesLeftover };
  }
}

// ---------- small utilities ----------

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

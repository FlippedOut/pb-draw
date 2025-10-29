import { describe, it, expect } from 'vitest';
import { TournamentMatcher } from '../utils/matchingAlgorithm';

const P = (id, extras = {}) => ({ id, name: `P${id}`, skillRating: 3.0, ...extras });
const pair = (a, b) => [P(a, { lockedPartner: b }), P(b, { lockedPartner: a })];

// TC-03: Locked pairs persist around byes
// If A and B are locked, whenever both are scheduled (not on bye), they should be on the same team.

describe('Locked pairs persist whenever both are playing', () => {
  it('ensures locked partners appear on the same team when not on bye', () => {
    const [a, b] = pair(1, 2);
    const [c, d] = pair(3, 4);
    const s5 = P(5);
    const s6 = P(6);
    const s7 = P(7);
    const s8 = P(8);

    const players = [a, b, c, d, s5, s6, s7, s8];
    const m = new TournamentMatcher(players, 4, 2); // 4 rounds, 2 courts
    const draws = m.generateDraw();

    const sameTeam = (match, x, y) => {
      const team1 = match.team1.map(p => p.id);
      const team2 = match.team2.map(p => p.id);
      return (team1.includes(x.id) && team1.includes(y.id)) || (team2.includes(x.id) && team2.includes(y.id));
    };

    for (const round of draws) {
      const byeIds = new Set(round.byes.map(p => p.id));
      const bothPlaying = !byeIds.has(a.id) && !byeIds.has(b.id);
      if (!bothPlaying) continue;

      // find a match where A and B are together
      const together = round.matches.some(m => sameTeam(m, a, b));
      expect(together).toBe(true);
    }
  });
});

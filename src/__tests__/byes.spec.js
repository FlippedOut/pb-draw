import { describe, it, expect } from 'vitest';
import { TournamentMatcher } from '../utils/matchingAlgorithm';

const P = (id, extras = {}) => ({ id, name: `P${id}`, skillRating: 3.0, ...extras });

// Helper to make a symmetric locked pair (both sides reference each other)
const pair = (a, b) => [P(a, { lockedPartner: b }), P(b, { lockedPartner: a })];

// TC-02: Bye priority order
// Scenario: 3 locked pairs (6 players) + 4 singles = 10 players, 2 courts => 8 play, 2 byes per round.
// Expectation: Singles receive byes before any member of a locked pair gets their first bye.

describe('Bye policy priority (singles before pair members)', () => {
  it('assigns singles to byes before any pair member gets a bye', () => {
    const [p1, p2] = pair(1, 2);
    const [p3, p4] = pair(3, 4);
    const [p5, p6] = pair(5, 6);
    const s7 = P(7);
    const s8 = P(8);
    const s9 = P(9);
    const s10 = P(10);

    const players = [p1, p2, p3, p4, p5, p6, s7, s8, s9, s10];

    const m = new TournamentMatcher(players, 4, 2); // 4 rounds, 2 courts (8 players per round)
    const draws = m.generateDraw();

    const isPairMember = new Set([1, 2, 3, 4, 5, 6]);
    const singles = new Set([7, 8, 9, 10]);

    const byeCounts = new Map(players.map(p => [p.id, 0]));

    for (const round of draws) {
      const roundByes = round.byes.map(p => p.id);
      for (const id of roundByes) {
        byeCounts.set(id, byeCounts.get(id) + 1);
      }

      // If any pair member just got their first bye in this round,
      // assert that all singles already have at least one bye.
      const pairMembersFirstByeThisRound = roundByes.filter(id => isPairMember.has(id) && byeCounts.get(id) === 1);
      if (pairMembersFirstByeThisRound.length > 0) {
        for (const sid of singles) {
          expect(byeCounts.get(sid)).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});

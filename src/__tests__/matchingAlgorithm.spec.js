import { describe, it, expect } from 'vitest';
import { TournamentMatcher } from '../utils/matchingAlgorithm';

// simple helper to make players quickly
const P = (id, extras = {}) => ({ id, name: `P${id}`, skillRating: 3.0, ...extras });

describe('TournamentMatcher basics', () => {
  it('assigns each player once per round', () => {
    const players = Array.from({ length: 16 }, (_, i) => P(i + 1));
    // Use 2 rounds and 11 courts per current engine signature (players, rounds, courts)
    const m = new TournamentMatcher(players, 2, 11);
    const draws = m.generateDraw(); // returns an array of rounds
    for (const round of draws) {
      const seen = new Set();
      for (const match of round.matches) {
        for (const pl of [...match.team1, ...match.team2]) {
          expect(seen.has(pl.id)).toBe(false);
          seen.add(pl.id);
        }
      }
      for (const pl of round.byes) {
        expect(seen.has(pl.id)).toBe(false);
        seen.add(pl.id);
      }
    }
  });
});
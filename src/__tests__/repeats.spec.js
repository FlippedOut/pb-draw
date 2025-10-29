import { describe, it, expect } from 'vitest';
import { TournamentMatcher } from '../utils/matchingAlgorithm';

const P = (id, extras = {}) => ({ id, name: `P${id}`, skillRating: 3.0, ...extras });

// With sufficient players, avoid repeat opponents across multiple rounds

describe('Avoid repeat opponents across early rounds when feasible', () => {
  it('produces unique opponents for first 3 rounds with 24 players and 6 courts', () => {
    const players = Array.from({ length: 24 }, (_, i) => P(i + 1));
    const m = new TournamentMatcher(players, 3, 6);
    const draws = m.generateDraw();

    const opponentsByPlayer = new Map();
    const addOpponents = (pid, ops) => {
      if (!opponentsByPlayer.has(pid)) opponentsByPlayer.set(pid, new Set());
      const set = opponentsByPlayer.get(pid);
      ops.forEach(o => set.add(o));
    };

    for (const round of draws) {
      for (const match of round.matches) {
        const team1Ids = match.team1.map(p => p.id);
        const team2Ids = match.team2.map(p => p.id);
        team1Ids.forEach(id => addOpponents(id, team2Ids));
        team2Ids.forEach(id => addOpponents(id, team1Ids));
      }
    }

    // Assert that opponents count equals games played * 2 for all players (no repeats)
    for (const [pid, ops] of opponentsByPlayer) {
      // each round a player faces 2 opponents; 3 rounds => 6 unique opponents
      expect(ops.size).toBeGreaterThanOrEqual(6);
    }
  });
});

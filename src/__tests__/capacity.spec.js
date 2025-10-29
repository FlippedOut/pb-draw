import { describe, it, expect } from 'vitest';
import { TournamentMatcher } from '../utils/matchingAlgorithm';

const P = (id, extras = {}) => ({ id, name: `P${id}`, skillRating: 3.0, ...extras });

describe('Capacity-based court usage', () => {
  it('uses floor(players/4) matches when players < courts*4', () => {
    const players = Array.from({ length: 42 }, (_, i) => P(i + 1));
    const m = new TournamentMatcher(players, 1, 11);
    const draws = m.generateDraw();
    const round = draws[0];
    expect(round.matches.length).toBe(10); // 10 courts, 2 byes
    const totalAssigned = round.matches.reduce((acc, match) => acc + match.team1.length + match.team2.length, 0) + round.byes.length;
    expect(totalAssigned).toBe(42);
  });
});

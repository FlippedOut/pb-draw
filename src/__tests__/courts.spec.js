import { describe, it, expect } from 'vitest';
import { TournamentMatcher } from '../utils/matchingAlgorithm';

// TC-05: Court numbering from starting court

const P = (id, extras = {}) => ({ id, name: `P${id}`, skillRating: 3.0, ...extras });

describe('Court numbering from starting court', () => {
  it('renders courts sequentially from the configured starting court (e.g., start=3 => 3,4,5,...)', () => {
    const players = Array.from({ length: 16 }, (_, i) => P(i + 1));
    const m = new TournamentMatcher(players, 1, 5, { startingCourt: 3 });
    const draws = m.generateDraw();
    const courts = draws[0].matches.map(m => m.court);
    expect(courts).toEqual([3, 4, 5, 6, 7]);
  });
});

import { describe, it, expect } from 'vitest';
import { TournamentMatcher } from '../utils/matchingAlgorithm';

const P = (id, extras = {}) => ({ id, name: `P${id}`, skillRating: 3.0, ...extras });
const pair = (a, b, gender) => [P(a, { gender, lockedPartner: b }), P(b, { gender, lockedPartner: a })];

// Ensures male vs male and female vs female when feasible, no male vs female pairings

describe('Gender category enforcement when feasible', () => {
  it('avoids male-pair vs female-pair when enough pairs exist', () => {
    // 2 male pairs and 2 female pairs, 2 courts
    const [m1, m2] = pair(1, 2, 'male');
    const [m3, m4] = pair(3, 4, 'male');
    const [f5, f6] = pair(5, 6, 'female');
    const [f7, f8] = pair(7, 8, 'female');

    const players = [m1, m2, m3, m4, f5, f6, f7, f8];
    const mtr = new TournamentMatcher(players, 1, 2);
    const draws = mtr.generateDraw();

    const round = draws[0];
    for (const match of round.matches) {
      const type1 = match.team1[0].gender === match.team1[1].gender ? (match.team1[0].gender === 'female' ? 'female-pair' : 'male-pair') : 'mixed';
      const type2 = match.team2[0].gender === match.team2[1].gender ? (match.team2[0].gender === 'female' ? 'female-pair' : 'male-pair') : 'mixed';
      expect(!(type1 === 'male-pair' && type2 === 'female-pair') && !(type1 === 'female-pair' && type2 === 'male-pair')).toBe(true);
    }
  });

  it('schedules mixed vs mixed when mixed pairs exist', () => {
    const [m1, f2] = [P(1, { gender: 'male' }), P(2, { gender: 'female' })];
    const [m3, f4] = [P(3, { gender: 'male' }), P(4, { gender: 'female' })];
    // lock into mixed pairs
    m1.lockedPartner = f2.id;
    f2.lockedPartner = m1.id;
    m3.lockedPartner = f4.id;
    f4.lockedPartner = m3.id;

    const players = [m1, f2, m3, f4];
    const mtr = new TournamentMatcher(players, 1, 1);
    const draws = mtr.generateDraw();
    const match = draws[0].matches[0];
    const type1 = match.team1[0].gender === match.team1[1].gender ? (match.team1[0].gender === 'female' ? 'female-pair' : 'male-pair') : 'mixed';
    const type2 = match.team2[0].gender === match.team2[1].gender ? (match.team2[0].gender === 'female' ? 'female-pair' : 'male-pair') : 'mixed';
    expect(type1).toBe('mixed');
    expect(type2).toBe('mixed');
  });
});

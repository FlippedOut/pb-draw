// src/utils/matchingAlgorithm.js

export class TournamentMatcher {
  constructor(players, courts = 8, toScore = 11, options = {}) {
    this.players = players;
    this.courts = courts;
    this.toScore = toScore;
    this.history = [];
    this.options = options;
  }

  // --- Generate the entire tournament draw ---
  generateDraw() {
    const draws = [];
    const totalRounds = Math.ceil(this.players.length / (this.courts * 4)) * 2;

    for (let r = 1; r <= totalRounds; r++) {
      const round = this.generateRound(r);
      draws.push(round);
    }

    return {
      totalPlayers: this.players.length,
      totalRounds,
      draws,
      canUndo: this.history.length > 0
    };
  }

  // --- Generate a single round ---
  generateRound(roundNumber) {
    const shuffled = [...this.players].sort(() => Math.random() - 0.5);
    const matches = [];
    const byes = [];

    for (let i = 0; i < shuffled.length; i += 4) {
      const court = (i / 4) + 1;
      const playersSlice = shuffled.slice(i, i + 4);

      if (playersSlice.length < 4) {
        byes.push(...playersSlice);
      } else {
        matches.push({
          id: `round${roundNumber}-court${court}`,
          court,
          team1: [playersSlice[0], playersSlice[1]],
          team2: [playersSlice[2], playersSlice[3]],
        });
      }
    }

    const roundData = { round: roundNumber, matches, byes };
    this.history.push(roundData);
    return roundData;
  }

  // --- Regenerate a specific round ---
  regenerateRound(roundNumber) {
    const newRound = this.generateRound(roundNumber);
    this.history[roundNumber - 1] = newRound;
    return newRound;
  }

  // --- Undo last regeneration ---
  undoLastRegeneration() {
    if (this.history.length === 0) return false;
    this.history.pop();
    return true;
  }

  // --- Get summary data ---
  getDrawSummary() {
    return {
      totalPlayers: this.players.length,
      totalRounds: this.history.length,
      draws: this.history,
      canUndo: this.history.length > 0
    };
  }
}

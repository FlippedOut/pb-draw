// constructor(players, courts, toScore, options = {})
constructor(players, courts = 8, toScore = 11, options = {}) {
  this.players = players;
  this.courts = courts;
  this.toScore = toScore;
  this.startCourt = options.startCourt ?? 1;
  this.history = []; // for undo
  this._summary = null;
}

// After you generate matches for each round, call:
_assignCourts(round) {
  // Ensures courts are sequential and limited to count, starting at startCourt
  const { startCourt, courts } = this;
  round.matches.forEach((m, idx) => {
    m.court = startCourt + (idx % courts);
  });
}

// Wherever you build the full summary:
getDrawSummary() {
  // ... compute summary { draws:[{ round, matches:[{id, team1, team2, court}], byes:[] }], totalPlayers, totalRounds, canUndo: ... }
  // After filling each round's matches array:
  this._summary.draws.forEach(r => this._assignCourts(r));
  return this._summary;
}

// Optional, to support your Regenerate Round button:
regenerateRound(roundNumber) {
  // Save previous state for undo:
  if (this._summary) this.history.push(JSON.parse(JSON.stringify(this._summary)));

  const idx = roundNumber - 1;
  const round = this._summary.draws[idx];
  // TODO: replace round.matches with a recomputed version for that round only
  // For now, a trivial shuffle to demonstrate:
  const shuffle = (arr) => arr.map(x => [Math.random(), x]).sort((a,b)=>a[0]-b[0]).map(x => x[1]);

  // Flatten players from the round (team1 + team2):
  const playersInRound = round.matches.flatMap(m => [...m.team1, ...m.team2]);
  const shuffled = shuffle(playersInRound);

  // Rebuild matches in pairs of 4 players (2 per team):
  const newMatches = [];
  for (let i = 0; i < shuffled.length; i += 4) {
    const team1 = [shuffled[i], shuffled[i+1]].filter(Boolean);
    const team2 = [shuffled[i+2], shuffled[i+3]].filter(Boolean);
    newMatches.push({
      id: `${round.round}-m${i/4+1}`,
      team1,
      team2,
      court: 0, // will be set by _assignCourts
    });
  }
  round.matches = newMatches;
  this._assignCourts(round);
  return round;
}

undoLastRegeneration() {
  if (!this.history.length) return false;
  this._summary = this.history.pop();
  return true;
}

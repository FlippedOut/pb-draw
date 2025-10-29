// Tournament matching algorithm for pickleball draws
export class TournamentMatcher {
  constructor(players, rounds = 8, courts = 11, options = {}) {
    this.players = players;
    this.rounds = rounds;
    this.courts = courts;
    this.startingCourt = options.startingCourt ?? 1;
    this.maxPlayersPerRound = courts * 4;
    this.draws = [];
    this.playerStats = new Map();
    this.previousDraw = null; // For undo functionality
    
    // Initialize player statistics
    this.initializePlayerStats();
  }

  initializePlayerStats() {
    this.players.forEach(player => {
      this.playerStats.set(player.id, {
        gamesPlayed: 0,
        opponents: new Set(),
        partners: new Set(),
        byeRounds: 0,
        byeCount: player.byeCount || 0, // Track total byes for fair rotation
        neverWith: new Set(player.neverWith || [])
      });
    });
  }

  generateDraw() {
    // Save current state for undo functionality
    if (this.draws.length > 0) {
      this.previousDraw = {
        draws: JSON.parse(JSON.stringify(this.draws)),
        playerStats: new Map([...this.playerStats].map(([k, v]) => [k, { ...v, opponents: new Set(v.opponents), partners: new Set(v.partners) }]))
      };
    }

    this.draws = [];
    
    for (let round = 1; round <= this.rounds; round++) {
      const roundMatches = this.generateRoundMatches(round);
      this.draws.push({
        round,
        matches: roundMatches,
        byes: this.calculateByes(roundMatches)
      });
    }
    
    return this.draws;
  }

  generateRoundMatches(roundNumber) {
    const availablePlayers = [...this.players];
    const matches = [];
    const usedPlayers = new Set();

    // First, handle locked pairs
    const lockedPairs = this.getLockedPairs(availablePlayers);
    const lockedMatches = this.createLockedPairMatches(lockedPairs, usedPlayers, roundNumber);
    matches.push(...lockedMatches);

    // Then handle remaining singles
    const remainingPlayers = availablePlayers.filter(p => !usedPlayers.has(p.id));
    const singleMatches = this.createSingleMatches(remainingPlayers, usedPlayers, roundNumber, 1); // temporary numbering; will renumber below
    matches.push(...singleMatches);

    // Limit matches to available courts and renumber courts starting from configured startingCourt
    const limited = matches.slice(0, this.courts);
    const now = Date.now();
    for (let i = 0; i < limited.length; i++) {
      const courtNum = this.startingCourt + i;
      limited[i].court = courtNum;
      limited[i].id = `match-${courtNum}-${now}`;
    }
    return limited;
  }

  getLockedPairs(players) {
    const pairs = [];
    const processed = new Set();

    players.forEach(player => {
      if (processed.has(player.id) || !player.lockedPartner) return;
      
      const partner = players.find(p => p.id === player.lockedPartner);
      if (partner && !processed.has(partner.id)) {
        pairs.push([player, partner]);
        processed.add(player.id);
        processed.add(partner.id);
      }
    });

    return pairs;
  }

  createLockedPairMatches(lockedPairs, usedPlayers, roundNumber) {
    const matches = [];
    const availablePairs = [...lockedPairs];
    let courtNumber = 1; // temporary numbering; renumbered later

    while (availablePairs.length >= 2 && matches.length < this.courts) {
      const pair1 = availablePairs.shift();
      const pair2 = this.findBestOpponentPair(pair1, availablePairs, roundNumber);
      
      if (pair2) {
        const pairIndex = availablePairs.indexOf(pair2);
        availablePairs.splice(pairIndex, 1);
        
        matches.push(this.createMatch(pair1, pair2, courtNumber));
        courtNumber++;
        pair1.forEach(p => usedPlayers.add(p.id));
        pair2.forEach(p => usedPlayers.add(p.id));
      }
    }

    return matches;
  }

  findBestOpponentPair(targetPair, availablePairs, roundNumber) {
    if (availablePairs.length === 0) return null;

    const targetType = this.getGenderMatchType(targetPair);
    const sameTypeCandidates = availablePairs.filter(p => this.getGenderMatchType(p) === targetType);
    const candidates = sameTypeCandidates.length > 0 ? sameTypeCandidates : availablePairs;

    // Score each potential opponent pair
    const scoredPairs = candidates.map(pair => ({
      pair,
      score: this.calculatePairMatchScore(targetPair, pair, roundNumber)
    }));

    // Sort by best score (highest is best match)
    scoredPairs.sort((a, b) => b.score - a.score);
    
    return scoredPairs[0]?.pair || null;
  }

  calculatePairMatchScore(pair1, pair2, roundNumber) {
    let score = 0;
    
    // Skill level matching (higher score for closer skills)
    const avgSkill1 = (pair1[0].skillRating + pair1[1].skillRating) / 2;
    const avgSkill2 = (pair2[0].skillRating + pair2[1].skillRating) / 2;
    const skillDiff = Math.abs(avgSkill1 - avgSkill2);
    score += Math.max(0, 10 - skillDiff * 2);

    // Gender preference (same gender matchups preferred)
    const genderMatch1 = this.getGenderMatchType(pair1);
    const genderMatch2 = this.getGenderMatchType(pair2);
    if (genderMatch1 === genderMatch2) {
      score += 30; // stronger preference for like-vs-like
    }
    // Strongly discourage male-pair vs female-pair unless absolutely necessary
    if ((genderMatch1 === 'male-pair' && genderMatch2 === 'female-pair') ||
        (genderMatch1 === 'female-pair' && genderMatch2 === 'male-pair')) {
      score -= 1000;
    }

    // Avoid repeat opponents
    const hasPlayedBefore = this.havePairsPlayedBefore(pair1, pair2);
    if (!hasPlayedBefore) {
      score += 40; // much stronger push to avoid repeats
    } else {
      score -= 50;
    }

    return score;
  }

  getGenderMatchType(pair) {
    const [p1, p2] = pair;
    if (p1.gender === p2.gender) {
      return p1.gender === 'female' ? 'female-pair' : 'male-pair';
    }
    return 'mixed';
  }

  havePairsPlayedBefore(pair1, pair2) {
    const [p1a, p1b] = pair1;
    const [p2a, p2b] = pair2;
    
    const stats1a = this.playerStats.get(p1a.id);
    const stats1b = this.playerStats.get(p1b.id);
    
    return stats1a.opponents.has(p2a.id) || stats1a.opponents.has(p2b.id) ||
           stats1b.opponents.has(p2a.id) || stats1b.opponents.has(p2b.id);
  }

 createSingleMatches(remainingPlayers, usedPlayers, roundNumber, startingCourtNumber) {
    const matches = [];
    const available = remainingPlayers.filter(p => !usedPlayers.has(p.id));
    let courtNumber = startingCourtNumber;
    
    while (available.length >= 4 && matches.length < this.courts) {
      const players = this.selectBestFoursome(available, roundNumber);
      if (players.length === 4) {
        const pairs = this.createOptimalPairs(players);
        matches.push(this.createMatch(pairs[0], pairs[1], courtNumber));
        courtNumber++;
        
        players.forEach(p => {
          usedPlayers.add(p.id);
          const index = available.indexOf(p);
          if (index > -1) available.splice(index, 1);
        });
      } else {
        break;
      }
    }

    return matches;
  }

  selectBestFoursome(players, roundNumber) {
    if (players.length < 4) return [];
    
    // For now, take first 4 available players
    // This can be enhanced with more sophisticated selection
    return players.slice(0, 4);
  }

  createOptimalPairs(fourPlayers) {
    // Create pairs trying to balance skill and gender preferences
    const [p1, p2, p3, p4] = fourPlayers;
    
    // Try different pairing combinations and score them
    const combinations = [
      [[p1, p2], [p3, p4]],
      [[p1, p3], [p2, p4]],
      [[p1, p4], [p2, p3]]
    ];
    
    const scoredCombinations = combinations.map(combo => ({
      pairs: combo,
      score: this.scorePairCombination(combo)
    }));
    
    scoredCombinations.sort((a, b) => b.score - a.score);
    return scoredCombinations[0].pairs;
  }

  scorePairCombination(pairCombination) {
    let score = 0;
    
    pairCombination.forEach(pair => {
      const [p1, p2] = pair;
      
      // Hard avoid never-pairs
      const p1Never = new Set(this.playerStats.get(p1.id)?.neverWith || []);
      if (p1Never.has(p2.id)) {
        score -= 1000;
      }

      // Skill balance within pair
      const skillDiff = Math.abs(p1.skillRating - p2.skillRating);
      score += Math.max(0, 5 - skillDiff);
      
      // Gender preferences
      if (p1.gender === p2.gender) {
        score += 5;
      }
      
      // Avoid repeat partnerships
      const stats = this.playerStats.get(p1.id);
      if (!stats.partners.has(p2.id)) {
        score += 5;
      }
    });

    // Enforce like-vs-like across the two pairs when possible
    if (pairCombination.length === 2) {
      const typeOf = (pair) => this.getGenderMatchType(pair);
      const type1 = typeOf(pairCombination[0]);
      const type2 = typeOf(pairCombination[1]);
      if (type1 === type2) {
        score += 40; // strong preference for same-category match
      } else {
        // Discourage cross-category (e.g., mixed vs male-pair or mixed vs female-pair)
        score -= 200;
      }
    }
    
    return score;
  }

  createMatch(pair1, pair2, courtNumber) {
    const match = {
      court: courtNumber,
      team1: pair1,
      team2: pair2,
      id: `match-${courtNumber}-${Date.now()}` // will be renumbered at round end
    };
    
    // Update player statistics
    this.updatePlayerStats(pair1, pair2);
    
    return match;
  }

  updatePlayerStats(pair1, pair2) {
    const allPlayers = [...pair1, ...pair2];
    
    allPlayers.forEach(player => {
      const stats = this.playerStats.get(player.id);
      stats.gamesPlayed++;
      
      // Add opponents
      allPlayers.forEach(opponent => {
        if (opponent.id !== player.id) {
          stats.opponents.add(opponent.id);
        }
      });
      
      // Add partner
      const partner = pair1.includes(player) ? 
        pair1.find(p => p.id !== player.id) : 
        pair2.find(p => p.id !== player.id);
      
      if (partner) {
        stats.partners.add(partner.id);
      }
    });
  }

  calculateByes(matches) {
    const playingPlayers = new Set();
    matches.forEach(match => {
      match.team1.forEach(p => playingPlayers.add(p.id));
      match.team2.forEach(p => playingPlayers.add(p.id));
    });
    
    const potentialByes = this.players.filter(p => !playingPlayers.has(p.id));
    
    // Implement fair bye rotation system
    if (potentialByes.length === 0) return [];
    
    // Sort players for fair bye assignment
    const sortedForByes = this.sortPlayersForByes(potentialByes);
    
    // Update bye counts for assigned byes
    sortedForByes.forEach(player => {
      const stats = this.playerStats.get(player.id);
      if (stats) {
        stats.byeCount++;
      }
    });
    
    return sortedForByes;
  }

 sortPlayersForByes(availablePlayers) {
   // Priority system for fair bye rotation:
   // 1. Singles first (no locked partner)
   // 2. Lowest bye count first
   // 3. If tie, random selection
   
   const singles = availablePlayers.filter(p => !p.lockedPartner);
   const pairs = availablePlayers.filter(p => p.lockedPartner);
   
   // Sort by bye count (ascending)
   const sortByByeCount = (players) => {
     return players.sort((a, b) => {
       const aStats = this.playerStats.get(a.id);
       const bStats = this.playerStats.get(b.id);
       const aByeCount = aStats ? aStats.byeCount : 0;
       const bByeCount = bStats ? bStats.byeCount : 0;
       return aByeCount - bByeCount;
     });
   };
   
   const sortedSingles = sortByByeCount([...singles]);
   const sortedPairs = sortByByeCount([...pairs]);
   
   // Check if all singles have had equal byes
   const minSingleByeCount = sortedSingles.length > 0 ? 
     (this.playerStats.get(sortedSingles[0].id)?.byeCount || 0) : 0;
   const maxSingleByeCount = sortedSingles.length > 0 ? 
     (this.playerStats.get(sortedSingles[sortedSingles.length - 1].id)?.byeCount || 0) : 0;
   
   // If singles still need rotation (haven't all had equal byes), prioritize them
   if (minSingleByeCount < maxSingleByeCount || (sortedSingles.length > 0 && sortedPairs.length > 0 && minSingleByeCount === 0)) {
     return sortedSingles;
   }
   
   // Otherwise, use normal priority order (singles first, then pairs, all sorted by bye count)
   return [...sortedSingles, ...sortedPairs];
 }

  getDrawSummary() {
    return {
      totalRounds: this.rounds,
      totalCourts: this.courts,
      totalPlayers: this.players.length,
      canUndo: this.previousDraw !== null,
      draws: this.draws
    };
  }
}

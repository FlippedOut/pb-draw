import React, { useState, useEffect } from 'react';
import { Link, Users, Unlink, ArrowRight } from 'lucide-react';

function PartnerPairing({ players, preConfirmedPairs = [], onPairingComplete }) {
  const [lockedPairs, setLockedPairs] = useState([]);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [selectedPlayer1, setSelectedPlayer1] = useState('');
  const [selectedPlayer2, setSelectedPlayer2] = useState('');
  const [avoidPlayer1, setAvoidPlayer1] = useState('');
  const [avoidPlayer2, setAvoidPlayer2] = useState('');
  const [neverPairs, setNeverPairs] = useState([]); // array of {id, a, b}

  useEffect(() => {
    // Initialize with pre-confirmed pairs from data input
    if (preConfirmedPairs.length > 0) {
      const convertedPairs = preConfirmedPairs.map(pair => ({
        id: `pre-confirmed-${pair.id}`,
        player1: pair.player1,
        player2: pair.player2,
        preConfirmed: true
      }));
      setLockedPairs(convertedPairs);
    }
  }, [preConfirmedPairs]);

  useEffect(() => {
    updateAvailablePlayers();
  }, [players, lockedPairs]);

  const updateAvailablePlayers = () => {
    const pairedPlayerIds = new Set();
    lockedPairs.forEach(pair => {
      pairedPlayerIds.add(pair.player1.id);
      pairedPlayerIds.add(pair.player2.id);
    });
    
    const available = players.filter(player => !pairedPlayerIds.has(player.id));
    setAvailablePlayers(available);
  };

  const convertBracketToRating = (bracket) => {
    const bracketMap = {
      '2.0-2.49': 2.25,
      '2.5-2.99': 2.75,
      '3.0-3.49': 3.25,
      '3.5-3.99': 3.75,
      '4.0-4.49': 4.25,
      '4.5-4.99': 4.75,
      '5.0-5.49': 5.25,
      '5.5+': 5.75
    };
    return bracketMap[bracket] || 3.0;
  };

  const createLockedPair = () => {
    if (!selectedPlayer1 || !selectedPlayer2 || selectedPlayer1 === selectedPlayer2) {
      return;
    }

    const player1 = players.find(p => p.id === selectedPlayer1);
    const player2 = players.find(p => p.id === selectedPlayer2);

    if (player1 && player2) {
      const newPair = {
        id: `pair-${lockedPairs.length + 1}`,
        player1,
        player2,
        preConfirmed: false
      };

      setLockedPairs(prev => [...prev, newPair]);
      setSelectedPlayer1('');
      setSelectedPlayer2('');
    }
  };

  const removePair = (pairId) => {
    // Only allow removal of manually created pairs, not pre-confirmed ones
    setLockedPairs(prev => prev.filter(pair => pair.id !== pairId || pair.preConfirmed));
  };

  const addNeverPair = () => {
    if (!avoidPlayer1 || !avoidPlayer2 || avoidPlayer1 === avoidPlayer2) return;
    const a = players.find(p => p.id === avoidPlayer1);
    const b = players.find(p => p.id === avoidPlayer2);
    if (!a || !b) return;
    const id = `avoid-${neverPairs.length + 1}`;
    setNeverPairs(prev => [...prev, { id, a, b }]);
    setAvoidPlayer1('');
    setAvoidPlayer2('');
  };

  const removeNeverPair = (id) => {
    setNeverPairs(prev => prev.filter(x => x.id !== id));
  };

  const handleComplete = () => {
    // Determine bracket normalization for locked pairs (promote to higher bracket)
    const pairBracketMap = new Map(); // playerId -> {bracket, rating}
    lockedPairs.forEach(p => {
      const b1 = p.player1.skillBracket;
      const b2 = p.player2.skillBracket;
      // choose higher by rating
      const r1 = convertBracketToRating(b1);
      const r2 = convertBracketToRating(b2);
      const highBracket = r1 >= r2 ? b1 : b2;
      const highRating = Math.max(r1, r2);
      pairBracketMap.set(p.player1.id, { bracket: highBracket, rating: highRating });
      pairBracketMap.set(p.player2.id, { bracket: highBracket, rating: highRating });
    });

    // Build neverWith adjacency from neverPairs
    const neverWithMap = new Map(); // id -> Set(ids)
    const addAvoid = (x, y) => {
      if (!neverWithMap.has(x)) neverWithMap.set(x, new Set());
      neverWithMap.get(x).add(y);
    };
    neverPairs.forEach(({ a, b }) => {
      addAvoid(a.id, b.id);
      addAvoid(b.id, a.id);
    });

    // Update players
    const updatedPlayers = players.map(player => {
      const pair = lockedPairs.find(p => p.player1.id === player.id || p.player2.id === player.id);
      const partnerId = pair ? (pair.player1.id === player.id ? pair.player2.id : pair.player1.id) : null;

      // apply bracket normalization if in a locked pair
      const norm = pairBracketMap.get(player.id);
      const normalized = norm
        ? { skillBracket: norm.bracket, skillRating: norm.rating }
        : {};

      const neverWith = Array.from(neverWithMap.get(player.id) || []);

      return {
        ...player,
        ...normalized,
        lockedPartner: partnerId,
        neverWith,
      };
    });

    onPairingComplete(updatedPlayers);
  };

  const getPlayerDisplayName = (player) => {
    return `${player.name} (${player.skillBracket}, ${player.gender})`;
  };

  const getPairSkillDifference = (player1, player2) => {
    return Math.abs(player1.skillRating - player2.skillRating);
  };

  const getPairGenderMatch = (player1, player2) => {
    if (player1.gender === player2.gender) {
      return player1.gender === 'female' ? 'Female Pair' : 'Male Pair';
    }
    return 'Mixed Pair';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">Partner Pairing</h2>
        <p className="text-neutral-600">
          Create locked pairs for players who must play together throughout the tournament.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create New Pair */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
            <Link className="w-5 h-5" />
            Create Locked Pair
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Player 1
              </label>
              <select
                value={selectedPlayer1}
                onChange={(e) => setSelectedPlayer1(e.target.value)}
                className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select Player 1</option>
                {availablePlayers.map(player => (
                  <option key={player.id} value={player.id}>
                    {getPlayerDisplayName(player)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Player 2
              </label>
              <select
                value={selectedPlayer2}
                onChange={(e) => setSelectedPlayer2(e.target.value)}
                className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select Player 2</option>
                {availablePlayers
                  .filter(player => player.id !== selectedPlayer1)
                  .map(player => (
                    <option key={player.id} value={player.id}>
                      {getPlayerDisplayName(player)}
                    </option>
                  ))}
              </select>
            </div>

            {selectedPlayer1 && selectedPlayer2 && (
              <div className="p-3 bg-neutral-50 rounded-lg">
                <div className="text-sm text-neutral-600">
                  <div>Skill Difference: {getPairSkillDifference(
                    players.find(p => p.id === selectedPlayer1),
                    players.find(p => p.id === selectedPlayer2)
                  ).toFixed(2)} points</div>
                  <div>Match Type: {getPairGenderMatch(
                    players.find(p => p.id === selectedPlayer1),
                    players.find(p => p.id === selectedPlayer2)
                  )}</div>
                </div>
              </div>
            )}

            <button
              onClick={createLockedPair}
              disabled={!selectedPlayer1 || !selectedPlayer2 || selectedPlayer1 === selectedPlayer2}
              className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
            >
              Create Pair
            </button>
          </div>
        </div>

        {/* Avoid Pairing */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
            <Unlink className="w-5 h-5" />
            Avoid Pairing (Never-pairs)
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Player A</label>
              <select
                value={avoidPlayer1}
                onChange={(e) => setAvoidPlayer1(e.target.value)}
                className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select Player</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>{getPlayerDisplayName(p)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Player B</label>
              <select
                value={avoidPlayer2}
                onChange={(e) => setAvoidPlayer2(e.target.value)}
                className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select Player</option>
                {players
                  .filter(p => p.id !== avoidPlayer1)
                  .map(p => (
                    <option key={p.id} value={p.id}>{getPlayerDisplayName(p)}</option>
                  ))}
              </select>
            </div>
            <button
              onClick={addNeverPair}
              disabled={!avoidPlayer1 || !avoidPlayer2 || avoidPlayer1 === avoidPlayer2}
              className="w-full bg-neutral-100 text-neutral-700 py-3 px-4 rounded-lg hover:bg-neutral-200 disabled:bg-neutral-200 transition-colors"
            >
              Add Avoid Pair
            </button>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {neverPairs.length === 0 ? (
                <div className="text-neutral-500 text-sm">No avoid-pairs added yet</div>
              ) : (
                neverPairs.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-neutral-50 border rounded">
                    <div className="text-sm text-neutral-800">
                      {item.a.name} ✕ {item.b.name}
                    </div>
                    <button onClick={() => removeNeverPair(item.id)} className="text-red-600 hover:underline text-sm">Remove</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Existing Pairs */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Locked Pairs ({lockedPairs.length})
            {preConfirmedPairs.length > 0 && (
              <span className="text-sm text-success-600">
                ({preConfirmedPairs.length} auto-detected)
              </span>
            )}
          </h3>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {lockedPairs.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                No locked pairs created yet
              </div>
            ) : (
              lockedPairs.map(pair => (
                <div key={pair.id} className={`p-4 border rounded-lg ${
                  pair.preConfirmed 
                    ? 'border-success-200 bg-success-50' 
                    : 'border-neutral-200 bg-neutral-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {pair.preConfirmed && (
                        <div className="flex items-center gap-1 mb-1">
                          <span className="px-2 py-1 bg-success-100 text-success-700 text-xs rounded-full">
                            Auto-detected
                          </span>
                        </div>
                      )}
                      <div className="font-medium text-neutral-900">
                        {pair.player1.name} & {pair.player2.name}
                      </div>
                      <div className="text-sm text-neutral-600 mt-1">
                        Skills: {pair.player1.skillBracket} & {pair.player2.skillBracket} | 
                        Type: {getPairGenderMatch(pair.player1, pair.player2)}
                      </div>
                    </div>
                    {!pair.preConfirmed && (
                      <button
                        onClick={() => removePair(pair.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Summary and Continue */}
      <div className="mt-8 pt-6 border-t border-neutral-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-600">
            <div>Total Players: {players.length}</div>
            <div>Locked Pairs: {lockedPairs.length} ({lockedPairs.length * 2} players)</div>
            <div>Singles: {availablePlayers.length} players</div>
          </div>
          
          <button
            onClick={handleComplete}
            className="flex items-center gap-2 bg-success-600 text-white px-6 py-3 rounded-lg hover:bg-success-700 transition-colors"
          >
            Continue to Draw Generation
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PartnerPairing;

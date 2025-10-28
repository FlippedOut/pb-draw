import React, { useState, useEffect } from 'react';
import { Link, Users, Unlink, ArrowRight } from 'lucide-react';

function PartnerPairing({ players, preConfirmedPairs = [], onPairingComplete }) {
  const [lockedPairs, setLockedPairs] = useState([]);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [selectedPlayer1, setSelectedPlayer1] = useState('');
  const [selectedPlayer2, setSelectedPlayer2] = useState('');

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

  const handleComplete = () => {
    // Update players with locked partner information
    const updatedPlayers = players.map(player => {
      const pair = lockedPairs.find(p => 
        p.player1.id === player.id || p.player2.id === player.id
      );
      
      if (pair) {
        const partnerId = pair.player1.id === player.id ? pair.player2.id : pair.player1.id;
        return { ...player, lockedPartner: partnerId };
      }
      
      return { ...player, lockedPartner: null };
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

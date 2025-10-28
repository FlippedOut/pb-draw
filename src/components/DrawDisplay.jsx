import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Printer, Edit3, RotateCcw, Users, Trophy, Settings, Undo2, RefreshCw, Trash2, Plus } from 'lucide-react';

function DrawDisplay({ drawData, players, onDrawUpdate, matcher, onPlayersUpdate, onReturnToPlayerData }) {
  const [editMode, setEditMode] = useState(false);
  const [currentDraw, setCurrentDraw] = useState(drawData);
  const [showPlayerManagement, setShowPlayerManagement] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', gender: 'M', skillBracket: '3.0-3.49', skillRating: 3.0 });

  // --- DND: two droppables per match: `${match.id}-team1` and `${match.id}-team2`
  const handleDragEnd = (result) => {
    if (!result.destination || !editMode) return;
    const src = parseLoc(result.source);
    const dst = parseLoc(result.destination);
    if (!src || !dst) return;

    const updated = swapPlayersStructured(currentDraw, src, dst);
    setCurrentDraw(updated);
  };

  const parseLoc = ({ droppableId, index }) => {
    // droppableId pattern: `${matchId}-team1` or `${matchId}-team2`
    const [matchId, teamId] = droppableId.split('-');
    if (!matchId || !teamId) return null;
    return { matchId, teamKey: teamId, index };
  };

  const swapPlayersStructured = (draw, src, dst) => {
    const next = JSON.parse(JSON.stringify(draw));
    let sMatch, dMatch;

    for (const round of next.draws) {
      for (const match of round.matches) {
        if (match.id === src.matchId) sMatch = match;
        if (match.id === dst.matchId) dMatch = match;
      }
    }
    if (!sMatch || !dMatch) return draw;

    const sList = sMatch[src.teamKey];
    const dList = dMatch[dst.teamKey];
    const [moved] = sList.splice(src.index, 1);
    dList.splice(dst.index, 0, moved);
    return next;
  };

  const printDraw = () => window.print();

  const regenerateDraw = () => {
    if (onDrawUpdate) onDrawUpdate();
  };

  // Guard for missing matcher.regenerateRound (your error #4)
  const regenerateRound = (roundNumber) => {
    if (matcher && typeof matcher.regenerateRound === 'function') {
      const updatedRound = matcher.regenerateRound(roundNumber);
      if (updatedRound) {
        const newDraw = { ...currentDraw };
        newDraw.draws[roundNumber - 1] = updatedRound;
        setCurrentDraw(newDraw);
      }
    } else {
      // Fallback: just call regenerate all
      regenerateDraw();
    }
  };

  const undoLastRegeneration = () => {
    if (matcher && typeof matcher.undoLastRegeneration === 'function' && matcher.undoLastRegeneration()) {
      const summary = matcher.getDrawSummary ? matcher.getDrawSummary() : currentDraw;
      setCurrentDraw(summary);
    }
  };

  const getPlayerDisplayName = (p) => `${p.name} (${p.skillRating})`;

  const getMatchQuality = (match) => {
    const team1Avg = (match.team1[0].skillRating + match.team1[1].skillRating) / 2;
    const team2Avg = (match.team2[0].skillRating + match.team2[1].skillRating) / 2;
    const difference = Math.abs(team1Avg - team2Avg);
    if (difference <= 0.5) return 'excellent';
    if (difference <= 1.0) return 'good';
    if (difference <= 1.5) return 'fair';
    return 'poor';
  };

  const getQualityColor = (quality) => ({
    excellent: 'bg-green-100 border-green-300',
    good: 'bg-blue-100 border-blue-300',
    fair: 'bg-yellow-100 border-yellow-300',
    poor: 'bg-red-100 border-red-300',
  }[quality] || 'bg-yellow-100 border-yellow-300');

  // --- Player management (your #7: remove/add)
  const handleRemovePlayer = (id) => {
    if (!onPlayersUpdate) return;
    const updated = players.filter((p) => p.id !== id);
    onPlayersUpdate(updated);
  };

  const handleAddPlayer = () => {
    if (!onPlayersUpdate || !newPlayer.name.trim()) return;
    const id = `p${Date.now()}`;
    const added = { ...newPlayer, id };
    onPlayersUpdate([...players, added]);
    setShowAddForm(false);
    setNewPlayer({ name: '', gender: 'M', skillBracket: '3.0-3.49', skillRating: 3.0 });
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header Controls */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Tournament Draw</h2>
          <p className="text-neutral-600">
            {currentDraw.totalPlayers} players across {currentDraw.totalRounds} rounds
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowPlayerManagement(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Edit Players
          </button>

          {currentDraw.canUndo && (
            <button
              onClick={undoLastRegeneration}
              className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
            >
              <Undo2 className="w-4 h-4" />
              Undo Last Regeneration
            </button>
          )}

          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              editMode ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            {editMode ? 'Exit Edit' : 'Edit Mode'}
          </button>

          <button
            onClick={regenerateDraw}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Regenerate All
          </button>

          <button
            onClick={printDraw}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Player Management Modal */}
      {showPlayerManagement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Edit Players</h3>
              <button onClick={() => setShowPlayerManagement(false)} className="text-neutral-500 hover:text-neutral-700">
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-neutral-600 mb-4">Remove or add players. Regenerate when ready.</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded">
                    <div>
                      <span className="font-medium">{player.name}</span>
                      <span className="text-sm text-neutral-600 ml-2">
                        ({player.skillBracket}, {player.gender})
                        {player.lockedPartner && <span className="ml-1 text-blue-600">• Paired</span>}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemovePlayer(player.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                      title="Remove player"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 rounded"
              >
                <Plus className="w-4 h-4" />
                Add Player
              </button>
            ) : (
              <div className="mt-3 grid gap-2 grid-cols-1 sm:grid-cols-2">
                <input
                  className="border p-2 rounded"
                  placeholder="Name"
                  value={newPlayer.name}
                  onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                />
                <select
                  className="border p-2 rounded"
                  value={newPlayer.gender}
                  onChange={(e) => setNewPlayer({ ...newPlayer, gender: e.target.value })}
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
                <input
                  className="border p-2 rounded"
                  placeholder="Skill rating e.g. 3.2"
                  type="number"
                  step="0.1"
                  value={newPlayer.skillRating}
                  onChange={(e) => setNewPlayer({ ...newPlayer, skillRating: parseFloat(e.target.value || '0') })}
                />
                <input
                  className="border p-2 rounded"
                  placeholder="Skill bracket e.g. 3.0-3.49"
                  value={newPlayer.skillBracket}
                  onChange={(e) => setNewPlayer({ ...newPlayer, skillBracket: e.target.value })}
                />
                <div className="col-span-1 sm:col-span-2 flex gap-2">
                  <button onClick={handleAddPlayer} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Save Player
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-2 bg-neutral-100 rounded hover:bg-neutral-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPlayerManagement(false);
                  onReturnToPlayerData();
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Player Management
              </button>
              <button onClick={() => setShowPlayerManagement(false)} className="px-4 py-2 bg-neutral-100 rounded-lg">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draw Rounds */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-8">
          {currentDraw.draws.map((round, roundIndex) => (
            <div key={roundIndex} className="bg-white rounded-lg shadow-lg p-6 print:break-after-page">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Round {round.round}
                </h3>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => regenerateRound(round.round)}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate Round
                  </button>
                  <div className="text-sm text-neutral-600">
                    {round.matches.length} matches | {round.byes.length} byes
                  </div>
                </div>
              </div>

              {/* Matches Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {round.matches.map((match) => {
                  const quality = getMatchQuality(match);
                  return (
                    <div key={match.id} className={`p-4 border-2 rounded-lg ${getQualityColor(quality)}`}>
                      <div className="text-center mb-3">
                        <div className="font-semibold text-neutral-900">Court {match.court}</div>
                        <div className="text-xs text-neutral-600 capitalize">{quality} match</div>
                      </div>

                      {/* Team 1 droppable */}
                      <div className="mb-2">
                        <div className="text-xs font-medium text-neutral-600 mb-1">Team 1</div>
                        <Droppable droppableId={`${match.id}-team1`} isDropDisabled={!editMode} direction="vertical">
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps}>
                              {match.team1.map((player, idx) => (
                                <Draggable key={player.id} draggableId={`${match.id}-t1-${player.id}`} index={idx} isDragDisabled={!editMode}>
                                  {(prov, snapshot) => (
                                    <div
                                      ref={prov.innerRef}
                                      {...prov.draggableProps}
                                      {...prov.dragHandleProps}
                                      className={`text-sm p-2 mb-1 rounded bg-white border ${snapshot.isDragging ? 'shadow-lg' : ''} ${editMode ? 'cursor-move' : ''}`}
                                    >
                                      {getPlayerDisplayName(player)}
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>

                      <div className="text-center text-xs font-bold text-neutral-500 my-2">VS</div>

                      {/* Team 2 droppable */}
                      <div>
                        <div className="text-xs font-medium text-neutral-600 mb-1">Team 2</div>
                        <Droppable droppableId={`${match.id}-team2`} isDropDisabled={!editMode} direction="vertical">
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps}>
                              {match.team2.map((player, idx) => (
                                <Draggable key={player.id} draggableId={`${match.id}-t2-${player.id}`} index={idx} isDragDisabled={!editMode}>
                                  {(prov, snapshot) => (
                                    <div
                                      ref={prov.innerRef}
                                      {...prov.draggableProps}
                                      {...prov.dragHandleProps}
                                      className={`text-sm p-2 mb-1 rounded bg-white border ${snapshot.isDragging ? 'shadow-lg' : ''} ${editMode ? 'cursor-move' : ''}`}
                                    >
                                      {getPlayerDisplayName(player)}
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Byes */}
              {round.byes.length > 0 && (
                <div className="border-t border-neutral-200 pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-neutral-600" />
                    <span className="font-medium text-neutral-700">Byes ({round.byes.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {round.byes.map((player) => (
                      <span key={player.id} className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-sm">
                        {getPlayerDisplayName(player)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Print styles are in global CSS (src/index.css) */}
    </div>
  );
}

export default DrawDisplay;

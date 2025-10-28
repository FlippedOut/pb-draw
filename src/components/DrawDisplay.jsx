import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Printer, Edit3, RotateCcw, Users, Trophy, Settings, Undo2, RefreshCw } from 'lucide-react';

function DrawDisplay({ drawData, players, onDrawUpdate, matcher, onPlayersUpdate, onReturnToPlayerData }) {
  const [editMode, setEditMode] = useState(false);
  const [currentDraw, setCurrentDraw] = useState(drawData);
  const [showPlayerManagement, setShowPlayerManagement] = useState(false);

  const handleDragEnd = (result) => {
    if (!result.destination || !editMode) return;

    const { source, destination } = result;

    // Parse the draggable IDs to get match and player info
    const sourceInfo = parsePlayerId(source.droppableId, result.draggableId);
    const destInfo = parsePlayerId(destination.droppableId, result.draggableId);

    if (!sourceInfo || !destInfo) return;

    // Create updated draw with swapped players
    const updatedDraw = swapPlayers(currentDraw, sourceInfo, destInfo, source.index, destination.index);
    setCurrentDraw(updatedDraw);
  };

  const parsePlayerId = (droppableId, draggableId) => {
    // Extract match info and player info from the draggable ID
    const parts = draggableId.split('-');
    if (parts.length < 4) return null;

    return {
      matchId: droppableId,
      team: parts[1], // team1 or team2
      playerId: parts[3],
    };
  };

  const swapPlayers = (draw, sourceInfo, destInfo, sourceIndex, destIndex) => {
    const newDraw = JSON.parse(JSON.stringify(draw));

    // Find matches in the draw
    let sourceMatch = null;
    let destMatch = null;

    newDraw.draws.forEach((round) => {
      round.matches.forEach((match) => {
        if (match.id === sourceInfo.matchId) {
          sourceMatch = match;
        }
        if (match.id === destInfo.matchId) {
          destMatch = match;
        }
      });
    });

    if (!sourceMatch || !destMatch) return draw;

    // Get players to swap
    const sourcePlayer = sourceMatch[sourceInfo.team][sourceIndex];
    const destPlayer = destMatch[destInfo.team][destIndex];

    // Perform the swap
    sourceMatch[sourceInfo.team][sourceIndex] = destPlayer;
    destMatch[destInfo.team][destIndex] = sourcePlayer;

    return newDraw;
  };

  const printDraw = () => {
    window.print();
  };

  const regenerateDraw = () => {
    if (onDrawUpdate) onDrawUpdate();
  };

  const regenerateRound = (roundNumber) => {
    if (matcher) {
      const updatedRound = matcher.regenerateRound(roundNumber);
      if (updatedRound) {
        const newDraw = { ...currentDraw };
        newDraw.draws[roundNumber - 1] = updatedRound;
        setCurrentDraw(newDraw);
      }
    }
  };

  const undoLastRegeneration = () => {
    if (matcher && matcher.undoLastRegeneration()) {
      const summary = matcher.getDrawSummary();
      setCurrentDraw(summary);
    }
  };

  const getPlayerDisplayName = (player) => `${player.name} (${player.skillRating})`;

  const getMatchQuality = (match) => {
    const team1Avg = (match.team1[0].skillRating + match.team1[1].skillRating) / 2;
    const team2Avg = (match.team2[0].skillRating + match.team2[1].skillRating) / 2;
    const difference = Math.abs(team1Avg - team2Avg);

    if (difference <= 0.5) return 'excellent';
    if (difference <= 1.0) return 'good';
    if (difference <= 1.5) return 'fair';
    return 'poor';
  };

  const getQualityColor = (quality) => {
    const colors = {
      excellent: 'bg-green-100 border-green-300',
      good: 'bg-blue-100 border-blue-300',
      fair: 'bg-yellow-100 border-yellow-300',
      poor: 'bg-red-100 border-red-300',
    };
    return colors[quality] || colors.fair;
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
              className="flex items-center gap-2 px-4 py-2 bg-warning-100 text-warning-700 rounded-lg hover:bg-warning-200 transition-colors"
            >
              <Undo2 className="w-4 h-4" />
              Undo Last Regeneration
            </button>
          )}

          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              editMode
                ? 'bg-warning-600 text-white hover:bg-warning-700'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            {editMode ? 'Exit Edit' : 'Edit Mode'}
          </button>

          <button
            onClick={regenerateDraw}
            className="flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Regenerate All
          </button>

          <button
            onClick={printDraw}
            className="flex items-center gap-2 px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors"
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
              <button
                onClick={() => setShowPlayerManagement(false)}
                className="text-neutral-500 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-neutral-600 mb-4">
                Make changes to players and regenerate the draw. This will create a completely new draw.
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded">
                    <div>
                      <span className="font-medium">{player.name}</span>
                      <span className="text-sm text-neutral-600 ml-2">
                        ({player.skillBracket}, {player.gender})
                        {player.lockedPartner && <span className="ml-1 text-primary-600">• Paired</span>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPlayerManagement(false);
                  onReturnToPlayerData();
                }}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Go to Player Management
              </button>
              <button
                onClick={() => setShowPlayerManagement(false)}
                className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                Cancel
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
                    className="flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors text-sm"
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
                    <Droppable key={match.id} droppableId={match.id} isDropDisabled={!editMode}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`p-4 border-2 rounded-lg transition-colors ${
                            getQualityColor(quality)
                          } ${snapshot.isDraggingOver ? 'border-primary-500' : ''}`}
                        >
                          <div className="text-center mb-3">
                            <div className="font-semibold text-neutral-900">Court {match.court}</div>
                            <div className="text-xs text-neutral-600 capitalize">{quality} match</div>
                          </div>

                          {/* Team 1 */}
                          <div className="mb-2">
                            <div className="text-xs font-medium text-neutral-600 mb-1">Team 1</div>
                            {match.team1.map((player, playerIndex) => (
                              <Draggable
                                key={player.id}
                                draggableId={`${match.id}-team1-${player.id}`}
                                index={playerIndex}
                                isDragDisabled={!editMode}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`text-sm p-2 mb-1 rounded bg-white border ${
                                      snapshot.isDragging ? 'shadow-lg' : ''
                                    } ${editMode ? 'cursor-move' : ''}`}
                                  >
                                    {getPlayerDisplayName(player)}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          </div>

                          <div className="text-center text-xs font-bold text-neutral-500 my-2">VS</div>

                          {/* Team 2 */}
                          <div>
                            <div className="text-xs font-medium text-neutral-600 mb-1">Team 2</div>
                            {match.team2.map((player, playerIndex) => (
                              <Draggable
                                key={player.id}
                                draggableId={`${match.id}-team2-${player.id}`}
                                index={playerIndex + 2}
                                isDragDisabled={!editMode}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`text-sm p-2 mb-1 rounded bg-white border ${
                                      snapshot.isDragging ? 'shadow-lg' : ''
                                    } ${editMode ? 'cursor-move' : ''}`}
                                  >
                                    {getPlayerDisplayName(player)}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          </div>
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
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
    </div>
  );
}

export default DrawDisplay;

// src/App.jsx
import React, { useState } from 'react';
import DataInput from './components/DataInput';
import PartnerPairing from './components/PartnerPairing';
import DrawDisplay from './components/DrawDisplay';
import DebugPanel from './components/DebugPanel';
import { TournamentMatcher } from './utils/matchingAlgorithm';
import { Trophy, Users, Target } from 'lucide-react';
import demoPlayers from './data/demoPlayers';

function App() {
  const [currentStep, setCurrentStep] = useState('input'); // 'input', 'pairing', 'draw'
  const [players, setPlayers] = useState([]);
  const [preConfirmedPairs, setPreConfirmedPairs] = useState([]);
  const [drawData, setDrawData] = useState(null);
  const [matcher, setMatcher] = useState(null);

  // Courts & starting court (already added earlier)
  const [courts, setCourts] = useState(8);
  const [startCourt, setStartCourt] = useState(1);

  const handleDataSubmit = (playerData, confirmedPairs = []) => {
    setPlayers(playerData);
    setPreConfirmedPairs(confirmedPairs);
    setCurrentStep('pairing');
  };

  const handlePairingComplete = (updatedPlayers) => {
    setPlayers(updatedPlayers);
    generateDraw(updatedPlayers);
  };

  const generateDraw = (playerList = players) => {
    const newMatcher = new TournamentMatcher(playerList, courts, 11, { startCourt });
    // These two calls depend on your matchingAlgorithm implementation
    newMatcher.generateDraw?.();
    const summary = newMatcher.getDrawSummary?.();
    setMatcher(newMatcher);
    setDrawData(summary || null);
    setCurrentStep('draw');
  };

  const handleDrawUpdate = () => generateDraw();

  const resetToStart = () => {
    setCurrentStep('input');
    setPlayers([]);
    setPreConfirmedPairs([]);
    setDrawData(null);
    setMatcher(null);
  };

  const handleStepNavigation = (step) => setCurrentStep(step);

  const getStepIcon = (s) => ({ input: Users, pairing: Target, draw: Trophy }[s]);
  const getStepTitle = (s) => ({ input: 'Player Data', pairing: 'Partner Pairing', draw: 'Tournament Draw' }[s]);

  const loadDemo = () => {
    setPlayers(demoPlayers);
    setPreConfirmedPairs([]);
    const newMatcher = new TournamentMatcher(demoPlayers, courts, 11, { startCourt });
    newMatcher.generateDraw?.();
    const summary = newMatcher.getDrawSummary?.();
    setMatcher(newMatcher);
    setDrawData(summary || null);
    setCurrentStep('draw');
  };

  const showDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">Pickleball Tournament Draw</h1>
                <p className="text-sm text-neutral-600">Professional tournament management system</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentStep !== 'input' && (
                <button
                  onClick={resetToStart}
                  className="px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  Start Over
                </button>
              )}
              <button
                onClick={loadDemo}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Load Demo
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-center space-x-8">
            {['input', 'pairing', 'draw'].map((step, index) => {
              const Icon = getStepIcon(step);
              const isActive = currentStep === step;
              const isCompleted = ['input', 'pairing', 'draw'].indexOf(currentStep) > index;
              const canNavigate =
                step === 'input' || (step === 'pairing' && players.length > 0) || (step === 'draw' && drawData);
              return (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => (canNavigate ? handleStepNavigation(step) : null)}
                    disabled={!canNavigate}
                    className={`flex items-center gap-3 transition-colors ${
                      isActive ? 'text-primary-600' : isCompleted ? 'text-success-600' : 'text-neutral-400'
                    } ${canNavigate ? 'hover:text-primary-700 cursor-pointer' : 'cursor-not-allowed'}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isActive ? 'bg-primary-100' : isCompleted ? 'bg-success-100' : 'bg-neutral-100'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-medium">{getStepTitle(step)}</span>
                  </button>
                  {index < 2 && <div className={`w-16 h-0.5 mx-4 ${isCompleted ? 'bg-success-300' : 'bg-neutral-200'}`} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="py-8">
        {currentStep === 'input' && (
          <div className="max-w-7xl mx-auto px-6">
            {/* Controls for courts and start court */}
            <div className="bg-white rounded-lg border p-4 mb-6">
              <h3 className="font-semibold mb-3">Courts</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2">
                  <span className="w-40 text-sm text-neutral-700">Number of courts</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={courts}
                    onChange={(e) => setCourts(parseInt(e.target.value || '0', 10))}
                    className="border rounded p-2 w-24"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-40 text-sm text-neutral-700">Starting court number</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={startCourt}
                    onChange={(e) => setStartCourt(parseInt(e.target.value || '0', 10))}
                    className="border rounded p-2 w-24"
                  />
                </label>
              </div>
            </div>

            <DataInput
              onDataSubmit={handleDataSubmit}
              initialPlayers={players}
              initialPreConfirmedPairs={preConfirmedPairs}
            />
          </div>
        )}

        {currentStep === 'pairing' && (
          <PartnerPairing
            players={players}
            preConfirmedPairs={preConfirmedPairs}
            onPairingComplete={handlePairingComplete}
          />
        )}

        {currentStep === 'draw' && drawData && (
          <DrawDisplay
            drawData={drawData}
            players={players}
            onDrawUpdate={handleDrawUpdate}
            matcher={matcher}
            onPlayersUpdate={setPlayers}
            onReturnToPlayerData={() => handleStepNavigation('input')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center text-neutral-600">
            <p className="mb-2">Professional Tournament Management System</p>
            <div className="text-sm">
              AI vibe coded development by{' '}
              <a href="https://biela.dev/" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700">
                Biela.dev
              </a>
              , powered by{' '}
              <a href="https://teachmecode.ae/" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700">
                TeachMeCode® Institute
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Debug overlay */}
      {showDebug && (
        <DebugPanel
          currentStep={currentStep}
          players={players}
          drawData={drawData}
          matcher={matcher}
          regenerateAll={handleDrawUpdate}
          regenerateRound={(n) => matcher?.regenerateRound?.(n)}
        />
      )}
    </div>
  );
}

export default App;

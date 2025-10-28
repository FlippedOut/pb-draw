// src/App.jsx
import React, { useState } from 'react';
import DataInput from './components/DataInput';
import PartnerPairing from './components/PartnerPairing';
import DrawDisplay from './components/DrawDisplay';
import TournamentSettings from './components/TournamentSettings';
import { TournamentMatcher } from './utils/matchingAlgorithm';
import { Trophy, Users, Target } from 'lucide-react';

function App() {
  const [currentStep, setCurrentStep] = useState('input'); // 'input', 'pairing', 'draw'
  const [players, setPlayers] = useState([]);
  const [preConfirmedPairs, setPreConfirmedPairs] = useState([]);
  const [drawData, setDrawData] = useState(null);
  const [matcher, setMatcher] = useState(null);

  // ✅ New: app-level tournament settings
  const [settings, setSettings] = useState({
    courts: 11,      // default
    startCourt: 1,   // default
    rounds: 8        // default
  });

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
    // Pass settings through to the matcher (courts/startCourt/rounds)
    const newMatcher = new TournamentMatcher(
      playerList,
      settings.courts,   // keep this aligned with options for clarity
      11,                // toScore (not used in layout yet)
      {
        courts: settings.courts,
        startCourt: settings.startCourt,
        rounds: settings.rounds
      }
    );

    const draw = newMatcher.generateDraw();
    const summary = newMatcher.getDrawSummary();

    setMatcher(newMatcher);
    setDrawData(summary);
    setCurrentStep('draw');
  };

  const handleDrawUpdate = () => {
    generateDraw();
  };

  const resetToStart = () => {
    setCurrentStep('input');
    setPlayers([]);
    setPreConfirmedPairs([]);
    setDrawData(null);
    setMatcher(null);
    // keep settings as-is so user choices persist
  };

  const handleStepNavigation = (step) => {
    setCurrentStep(step);
  };

  const getStepIcon = (step) => {
    const icons = { input: Users, pairing: Target, draw: Trophy };
    return icons[step];
  };

  const getStepTitle = (step) => {
    const titles = { input: 'Player Data', pairing: 'Partner Pairing', draw: 'Tournament Draw' };
    return titles[step];
  };

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
            {currentStep !== 'input' && (
              <button
                onClick={resetToStart}
                className="px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                Start Over
              </button>
            )}
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
                step === 'input' ||
                (step === 'pairing' && players.length > 0) ||
                (step === 'draw' && drawData);

              return (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => (canNavigate ? handleStepNavigation(step) : null)}
                    disabled={!canNavigate}
                    className={`flex items-center gap-3 transition-colors ${
                      isActive
                        ? 'text-primary-600'
                        : isCompleted
                        ? 'text-success-600'
                        : 'text-neutral-400'
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

                  {index < 2 && (
                    <div className={`w-16 h-0.5 mx-4 ${isCompleted ? 'bg-success-300' : 'bg-neutral-200'}`} />
                  )}
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
            {/* ✅ New: settings panel on the first screen */}
            <TournamentSettings settings={settings} setSettings={setSettings} />

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
              <a
                href="https://biela.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 transition-colors"
              >
                Biela.dev
              </a>
              , powered by{' '}
              <a
                href="https://teachmecode.ae/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 transition-colors"
              >
                TeachMeCode® Institute
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

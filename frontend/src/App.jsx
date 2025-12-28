import React, { useState, useEffect } from 'react';
import PokerTable from './components/Table/PokerTable';
import ActionPanel from './components/Controls/ActionPanel';
import StatsPanel from './components/Display/StatsPanel';
import { useGameState } from './hooks/useGameState';

function App() {
  const {
    gameState,
    loading,
    error,
    processingComputer,
    startNewGame,
    submitAction,
    isHumanTurn
  } = useGameState();

  const [selectedPosition, setSelectedPosition] = useState('BTN'); // IP by default

  // Auto-start game on page load
  useEffect(() => {
    startNewGame(selectedPosition);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewHand = () => {
    startNewGame(selectedPosition);
  };

  const handleAction = async (action, amount) => {
    await submitAction(action, amount);
  };

  const getPlayerStats = () => {
    if (!gameState || !gameState.action_on) return null;
    const player = gameState.players[gameState.action_on];
    return {
      ...gameState.stats,
      playerBet: player?.current_bet || 0
    };
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Poker Hand Reading Trainer
            </h1>
            <p className="text-sm text-gray-400">
              Heads-Up No-Limit Texas Hold'em
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Position selector */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Position:</span>
              <div className="flex rounded-lg overflow-hidden border border-gray-600">
                <button
                  onClick={() => setSelectedPosition('BTN')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedPosition === 'BTN'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  IP
                </button>
                <button
                  onClick={() => setSelectedPosition('BB')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedPosition === 'BB'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  OOP
                </button>
              </div>
            </div>

            <button
              onClick={handleNewHand}
              disabled={loading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              New Hand
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Error display */}
          {error && (
            <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
              {error}
            </div>
          )}

          {/* Loading overlay - only show for initial load, not computer actions */}
          {loading && !gameState && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
              <div className="bg-gray-800 rounded-xl p-6 flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-white">Starting game...</span>
              </div>
            </div>
          )}

          {/* Poker table */}
          <div className="mb-8">
            <PokerTable gameState={gameState} />
          </div>

          {/* Controls section */}
          {gameState && !gameState.hand_complete && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {/* Stats panel */}
              <div className="lg:col-span-1">
                <StatsPanel
                  stats={getPlayerStats()}
                  currentBet={gameState.current_bet}
                  playerBet={gameState.players[gameState.action_on]?.current_bet || 0}
                />
              </div>

              {/* Action panel */}
              <div className="lg:col-span-2">
                {isHumanTurn ? (
                  <ActionPanel
                    availableActions={gameState.available_actions}
                    minRaise={gameState.min_raise}
                    maxRaise={gameState.max_raise}
                    currentBet={gameState.current_bet}
                    playerBet={gameState.players[gameState.action_on]?.current_bet || 0}
                    pot={gameState.pot}
                    onAction={handleAction}
                    disabled={loading}
                  />
                ) : (
                  <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-700 text-center">
                    <div className="flex items-center justify-center gap-3 text-gray-400">
                      {processingComputer && (
                        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                      )}
                      <span>
                        {processingComputer
                          ? `${gameState.players[gameState.action_on]?.position || 'Opponent'} is acting...`
                          : 'Waiting for opponent...'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hand complete - New hand button */}
          {gameState?.hand_complete && (
            <div className="text-center mt-8">
              <button
                onClick={handleNewHand}
                disabled={loading}
                className="px-8 py-4 bg-gradient-to-b from-green-500 to-green-700 text-white text-xl font-bold rounded-xl hover:from-green-400 hover:to-green-600 transition-all hover:scale-105 active:scale-100 disabled:opacity-50"
              >
                Deal New Hand
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900/80 border-t border-gray-800 py-3 px-6">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500">
          Practice hand reading in heads-up situations
        </div>
      </footer>
    </div>
  );
}

export default App;

import React, { useState } from 'react';
import PokerTable from './components/Table/PokerTable';
import ActionPanel from './components/Controls/ActionPanel';
import StatsPanel from './components/Display/StatsPanel';
import GameSetup from './components/GameSetup';
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

  const [showSetup, setShowSetup] = useState(true);
  const [gameConfig, setGameConfig] = useState(null);
  const [handNumber, setHandNumber] = useState(1);

  const handleStartGame = async (config) => {
    setGameConfig(config);
    setShowSetup(false);
    await startNewGame(config.hero_position, config.villain_position);
  };

  const handleNewHand = async () => {
    if (gameConfig) {
      setHandNumber(prev => prev + 1);
      await startNewGame(gameConfig.hero_position, gameConfig.villain_position);
    }
  };

  const handleNewGame = () => {
    setShowSetup(true);
    setHandNumber(1);
  };

  const handleAction = async (action, amount) => {
    await submitAction(action, amount);
  };

  const getStatusText = () => {
    if (gameState?.hand_complete) return 'Hand complete';
    if (isHumanTurn) return 'Your turn';
    if (processingComputer) return 'Processing...';
    return 'Waiting...';
  };

  // Show setup screen
  if (showSetup) {
    return (
      <div className="app">
        <div className="header">
          <h1>Poker Hand Reading Trainer</h1>
          <p>Heads-Up 6-Max Training</p>
        </div>
        <GameSetup onStartGame={handleStartGame} loading={loading} />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Poker Hand Reading Trainer</h1>
        <p>
          Hand #{handNumber} | {getStatusText()}
          <button
            onClick={handleNewGame}
            style={{
              marginLeft: 15,
              padding: '4px 12px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 4,
              color: 'var(--text-light)',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            New Game
          </button>
        </p>
      </div>

      {error && (
        <div className="error">
          {error}
          <button onClick={() => window.location.reload()}>Dismiss</button>
        </div>
      )}

      <div className="game-container">
        <div className="main-area">
          <PokerTable gameState={gameState} />

          {gameState?.hand_complete ? (
            <div className="showdown-message">
              <div className="winner-text">
                {gameState.winner ? `${gameState.players[gameState.winner]?.label || gameState.winner} Wins!` : 'Hand Complete'}
              </div>
              {gameState.winning_hand && (
                <div className="hand-rank">{gameState.winning_hand}</div>
              )}
              <button className="new-hand-btn" onClick={handleNewHand} disabled={loading} style={{ marginTop: 12 }}>
                Deal New Hand
              </button>
            </div>
          ) : isHumanTurn ? (
            <ActionPanel
              availableActions={gameState?.available_actions || []}
              minRaise={gameState?.min_raise || 0}
              maxRaise={gameState?.max_raise || 0}
              currentBet={gameState?.current_bet || 0}
              playerBet={gameState?.players[gameState?.action_on]?.current_bet || 0}
              pot={gameState?.pot || 0}
              onAction={handleAction}
              disabled={loading}
            />
          ) : (
            <div className="waiting">
              {processingComputer ? 'Processing...' : 'Waiting for opponent...'}
            </div>
          )}
        </div>

        <div className="side-panel">
          <StatsPanel gameState={gameState} />

          <div className="range-grid-container">
            <h3>AI Range</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Complete the hand to see AI ranges
            </p>
          </div>

          <div className="hand-review">
            <h3>Hand Review</h3>
            {gameState?.action_history && gameState.action_history.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {gameState.action_history.slice(-10).map((action, i) => (
                  <div key={i} className="review-item" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--chip-blue)', fontWeight: 600 }}>{action.position}</span>
                    <span style={{
                      color: action.action === 'fold' ? '#3d7cb8' :
                             action.action === 'check' ? '#3b82f6' :
                             action.action === 'call' ? '#5ab966' : '#f03c3c'
                    }}>
                      {action.action.toUpperCase()}
                    </span>
                    {action.amount > 0 && (
                      <span style={{ color: 'var(--gold)' }}>${action.amount}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Complete the hand to review actions
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

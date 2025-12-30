import React, { useState } from 'react';
import PokerTable from './components/Table/PokerTable';
import ActionPanel from './components/Controls/ActionPanel';
import StrategyGrid from './components/Display/StrategyGrid';
import GameSetup, { getOpponentStyleIcon } from './components/GameSetup';
import { useGameState } from './hooks/useGameState';

// 4-color deck: spades black, hearts red, diamonds blue, clubs green
const SUIT_COLORS = {
  's': '#000000',  // Spades - Black
  'h': '#e03131',  // Hearts - Red
  'd': '#1c7ed6',  // Diamonds - Blue
  'c': '#2f9e44',  // Clubs - Green
};

const SUIT_SYMBOLS = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };

// Format a single card with colored suit symbol
const formatCardColored = (card) => {
  if (!card || card === '??') return <span>??</span>;
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const symbol = SUIT_SYMBOLS[suit] || suit;
  const color = SUIT_COLORS[suit] || '#000';
  return (
    <span key={card}>
      <span style={{ color }}>{rank}{symbol}</span>
    </span>
  );
};

// Format hand with colored cards
const formatHandColored = (cards) => {
  if (!cards || cards.length === 0) return <span>??</span>;
  return cards.map((card, i) => <span key={i}>{formatCardColored(card)}</span>);
};

// Sort actions: check/call first, bets smallest to largest, fold last
const sortActions = (entries) => {
  return [...entries].sort(([a], [b]) => {
    const getOrder = (action) => {
      if (action === 'X' || action === 'C' || action === 'Check' || action === 'Call' || action === 'X/C') return 0;
      if (action.startsWith('B')) {
        const amount = parseInt(action.substring(1)) || 0;
        return 1 + amount / 10000; // Small offset for bet ordering
      }
      if (action === 'Fold') return 100000;
      return 50000;
    };
    return getOrder(a) - getOrder(b);
  });
};

function App() {
  const {
    gameState,
    loading,
    error,
    processingComputer,
    startNewGame,
    submitAction,
    triggerComputerAction,
    isHumanTurn
  } = useGameState();

  const [showSetup, setShowSetup] = useState(true);
  const [gameConfig, setGameConfig] = useState(null);
  const [handNumber, setHandNumber] = useState(1);
  const [heroCanAct, setHeroCanAct] = useState(false);
  const [strategyCollapsed, setStrategyCollapsed] = useState(true);
  const [testingCollapsed, setTestingCollapsed] = useState(true);
  const [selectedStrategyIndex, setSelectedStrategyIndex] = useState(null);

  const handleStartGame = async (config) => {
    setGameConfig(config);
    setShowSetup(false);
    setSelectedStrategyIndex(null);
    await startNewGame(config.hero_position, config.villain_position);
  };

  const handleNewHand = async () => {
    if (gameConfig) {
      setHandNumber(prev => prev + 1);
      setSelectedStrategyIndex(null);
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
          <PokerTable
            gameState={gameState}
            onHeroCanAct={setHeroCanAct}
            onComputerAction={triggerComputerAction}
            opponentStyleIcon={gameConfig ? getOpponentStyleIcon(gameConfig.opponent_style) : ''}
            opponentStyleName={gameConfig?.opponent_style || 'Villain'}
          />

          {gameState?.hand_complete ? (
            <div className="showdown-message">
              <div className="winner-text">
                {gameState.winner ? `${gameState.players[gameState.winner]?.label || gameState.winner} Wins!` : 'Hand Complete'}
              </div>
              {gameState.winning_hand && (
                <div className="hand-rank">{gameState.winning_hand}</div>
              )}
              <div className="hand-complete-buttons">
                <button className="new-hand-btn" onClick={handleNewHand} disabled={loading}>
                  Deal New Hand
                </button>
                <button className="different-spot-btn" onClick={handleNewGame} disabled={loading}>
                  Train a Different Spot
                </button>
              </div>
            </div>
          ) : isHumanTurn && heroCanAct ? (
            <ActionPanel
              availableActions={gameState?.available_actions || []}
              pioActions={gameState?.pio_actions}
              currentBet={gameState?.current_bet || 0}
              playerBet={gameState?.players[gameState?.action_on]?.current_bet || 0}
              pot={gameState?.pot || 0}
              street={gameState?.street || 'preflop'}
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
          <div className={`range-grid-container collapsible ${strategyCollapsed ? 'collapsed' : ''}`}>
            <h3 className="collapsible-header" onClick={() => setStrategyCollapsed(!strategyCollapsed)}>
              <span className="collapse-icon">{strategyCollapsed ? '▶' : '▼'}</span>
              {gameConfig ? `${getOpponentStyleIcon(gameConfig.opponent_style)} ${gameConfig.opponent_style}` : 'AI'} Strategy
            </h3>
            {!strategyCollapsed && (
              <StrategyGrid
                strategyData={gameState?.villain_strategy}
                strategyHistory={gameState?.strategy_history}
                selectedIndex={selectedStrategyIndex}
                onSelectIndex={setSelectedStrategyIndex}
              />
            )}
          </div>

          <div className={`testing-panel collapsible ${testingCollapsed ? 'collapsed' : ''}`}>
            <h3 className="collapsible-header" onClick={() => setTestingCollapsed(!testingCollapsed)}>
              <span className="collapse-icon">{testingCollapsed ? '▶' : '▼'}</span>
              Testing
            </h3>
            {!testingCollapsed && <div className="hand-strategies">
              <div className="strategy-row villain-strategy">
                <span className="strategy-label">{gameConfig ? `${getOpponentStyleIcon(gameConfig.opponent_style)} ${gameConfig.opponent_style}` : 'Villain'}:</span>
                <div className="strategy-data">
                  <div className="combo-freq-row">
                    <span className="hand-text">
                      {formatHandColored(gameState?.players?.[gameState?.villain_position]?.hole_cards)}
                    </span>
                    <span className="data-label">In Range:</span>
                    {gameState?.players?.[gameState?.villain_position]?.combo_frequency != null ? (
                      <span className="combo-freq">{gameState.players[gameState.villain_position].combo_frequency}%</span>
                    ) : (
                      <span className="no-strategy">—</span>
                    )}
                  </div>
                  <div className="action-freq-row">
                    <span className="data-label">Action:</span>
                    {gameState?.players?.[gameState?.villain_position]?.hand_strategy ? (
                      <div className="hand-strategy">
                        {sortActions(Object.entries(gameState.players[gameState.villain_position].hand_strategy)).map(([action, freq]) => (
                          <span key={action} className="strategy-item">{action}: {freq}%</span>
                        ))}
                      </div>
                    ) : (
                      <span className="no-strategy">—</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="strategy-row">
                <span className="strategy-label">Hero:</span>
                {gameState?.players?.[gameState?.human_position]?.hand_strategy ? (
                  <div className="hand-strategy">
                    {sortActions(Object.entries(gameState.players[gameState.human_position].hand_strategy)).map(([action, freq]) => (
                      <span key={action} className="strategy-item">{action}: {freq}%</span>
                    ))}
                  </div>
                ) : (
                  <span className="no-strategy">—</span>
                )}
              </div>
              {gameState?.pio_node && gameState?.street !== 'preflop' && (
                <div className="strategy-row">
                  <span className="strategy-label">Node:</span>
                  <span className="pio-node-text">{gameState.pio_node}</span>
                </div>
              )}
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

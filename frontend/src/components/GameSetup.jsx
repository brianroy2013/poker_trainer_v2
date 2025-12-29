import React, { useState } from 'react';

const POSITIONS = ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'];

export default function GameSetup({ onStartGame, loading }) {
  const [heroPosition, setHeroPosition] = useState('BTN');
  const [villainPosition, setVillainPosition] = useState('BB');

  const handleStart = () => {
    onStartGame({
      hero_position: heroPosition,
      villain_position: villainPosition
    });
  };

  // Get available villain positions (all except hero's position)
  const availableVillainPositions = POSITIONS.filter(p => p !== heroPosition);

  // If villain position is same as hero, reset to first available
  if (villainPosition === heroPosition) {
    setVillainPosition(availableVillainPositions[0]);
  }

  return (
    <div className="game-setup">
      <h2>Game Setup</h2>
      <p className="setup-description">
        Select your position and your opponent's position.
        The other 4 players will fold preflop.
      </p>

      <div className="position-selectors">
        <div className="position-selector">
          <label>Your Position</label>
          <div className="position-buttons">
            {POSITIONS.map(pos => (
              <button
                key={pos}
                className={`position-btn ${heroPosition === pos ? 'selected hero' : ''}`}
                onClick={() => setHeroPosition(pos)}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        <div className="position-selector">
          <label>Opponent Position</label>
          <div className="position-buttons">
            {POSITIONS.map(pos => (
              <button
                key={pos}
                className={`position-btn ${villainPosition === pos ? 'selected villain' : ''} ${pos === heroPosition ? 'disabled' : ''}`}
                onClick={() => pos !== heroPosition && setVillainPosition(pos)}
                disabled={pos === heroPosition}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="setup-summary">
        <p>
          <strong>Matchup:</strong> You ({heroPosition}) vs Villain ({villainPosition})
        </p>
      </div>

      <button
        className="start-game-btn"
        onClick={handleStart}
        disabled={loading}
      >
        {loading ? 'Starting...' : 'Start Game'}
      </button>
    </div>
  );
}

import React, { useState } from 'react';

export function StatsPanel({ gameState }) {
  const [selectedPlayer, setSelectedPlayer] = useState('ai1');

  // Get AI players from game state
  const getAIPlayers = () => {
    if (!gameState?.players) return [];

    const players = gameState.players;
    if (Array.isArray(players)) {
      return players.filter(p => p && !p.is_hero && !p.is_human);
    }

    // Object format
    return Object.entries(players)
      .filter(([pos, p]) => p && !p.is_hero && !p.is_human)
      .map(([pos, p]) => ({ ...p, position: pos }));
  };

  const aiPlayers = getAIPlayers();

  // Mock stats - in real implementation, these would come from tracking
  const stats = {
    vpip: '0%',
    pfr: '0%',
    threeBet: '-%',
    af: '-',
    cbet: '-%',
    wtsd: '0%',
    wssd: '-%',
    hands: '1'
  };

  return (
    <div className="stats-panel">
      <h3>AI Statistics</h3>

      <select
        className="player-select"
        value={selectedPlayer}
        onChange={(e) => setSelectedPlayer(e.target.value)}
      >
        {aiPlayers.map((player, i) => (
          <option key={i} value={`ai${i + 1}`}>
            {player.name || `AI${i + 1}`} ({player.position})
          </option>
        ))}
        {aiPlayers.length === 0 && (
          <>
            <option value="ai1">AI1 (SB)</option>
            <option value="ai2">AI2 (BB)</option>
            <option value="ai3">AI3 (UTG)</option>
            <option value="ai4">AI4 (MP)</option>
            <option value="ai5">AI5 (CO)</option>
          </>
        )}
      </select>

      <div className="stat-row">
        <span className="stat-label">VPIP</span>
        <span className="stat-value">{stats.vpip}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">PFR</span>
        <span className="stat-value">{stats.pfr}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">3-Bet</span>
        <span className="stat-value">{stats.threeBet}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">AF</span>
        <span className="stat-value">{stats.af}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">C-Bet</span>
        <span className="stat-value">{stats.cbet}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">WTSD</span>
        <span className="stat-value">{stats.wtsd}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">W$SD</span>
        <span className="stat-value">{stats.wssd}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Hands</span>
        <span className="stat-value">{stats.hands}</span>
      </div>
    </div>
  );
}

export default StatsPanel;

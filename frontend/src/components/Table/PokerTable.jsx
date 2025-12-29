import React from 'react';
import Seat from './Seat';
import Card from '../Cards/Card';

// Map position names to seat indices (0-5 for 6-max)
// Backend uses: UTG, MP, CO, BTN, SB, BB
const POSITION_TO_SEAT = {
  'BTN': 0, // Hero position (bottom center)
  'SB': 1,  // Bottom left
  'BB': 2,  // Top left
  'UTG': 3, // Top center
  'MP': 4,  // Top right
  'CO': 5   // Bottom right
};

// Position order for rendering (matches seat positions 0-5)
const POSITION_ORDER = ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'];

export default function PokerTable({ gameState }) {
  if (!gameState) {
    return (
      <div className="poker-table" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff' }}>Loading...</span>
      </div>
    );
  }

  const board = gameState.board || gameState.community_cards || [];
  const pot = gameState.pot || 0;
  const street = gameState.street || 'preflop';

  // Get players in correct order
  const getPlayersArray = () => {
    if (Array.isArray(gameState.players)) {
      return gameState.players;
    }
    // V2 format - object with position keys
    return POSITION_ORDER.map(pos => {
      const player = gameState.players[pos];
      if (player) {
        return {
          ...player,
          position: pos,
          cards: player.hole_cards || player.cards
        };
      }
      return null;
    });
  };

  const players = getPlayersArray();
  const actionOn = gameState.action_on;

  // Determine which seat index is active
  const getActiveSeatIndex = () => {
    if (typeof actionOn === 'number') return actionOn;
    return POSITION_TO_SEAT[actionOn] ?? -1;
  };

  const activeSeatIndex = getActiveSeatIndex();

  // Find dealer position
  const getDealerSeatIndex = () => {
    if (gameState.dealer_position !== undefined) {
      return gameState.dealer_position;
    }
    // Find BTN player
    const btnIndex = players.findIndex(p => p?.position === 'BTN');
    return btnIndex >= 0 ? btnIndex : 1;
  };

  const dealerSeatIndex = getDealerSeatIndex();

  return (
    <div className="poker-table">
      {/* Board area with community cards and pot */}
      <div className="board-area">
        <div className="board-cards">
          {board.length > 0 ? (
            board.map((card, i) => (
              <Card key={i} card={card} />
            ))
          ) : (
            // Empty card placeholders
            [0, 1, 2, 3, 4].map(i => (
              <div key={i} className="card empty" />
            ))
          )}
        </div>
        <div className="pot-display">
          Pot: <span className="pot-amount">${pot}</span>
          <span style={{ marginLeft: 12, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {street.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Player seats */}
      {players.map((player, i) => (
        <Seat
          key={i}
          player={player}
          seatIndex={i}
          isActive={activeSeatIndex === i}
          isDealer={dealerSeatIndex === i}
          actionHistory={gameState.action_history}
        />
      ))}

      {/* Winner announcement overlay */}
      {gameState.hand_complete && gameState.winner && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0,0,0,0.85)',
          padding: '20px 40px',
          borderRadius: 16,
          border: '2px solid var(--gold)',
          zIndex: 50,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--gold)' }}>
            {gameState.winner} Wins!
          </div>
          <div style={{ color: '#ccc', fontSize: 18, marginTop: 8 }}>
            Pot: ${pot}
          </div>
        </div>
      )}
    </div>
  );
}

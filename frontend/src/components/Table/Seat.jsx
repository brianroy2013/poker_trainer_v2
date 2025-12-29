import React from 'react';
import Card from '../Cards/Card';

const BIG_BLIND = 5;

// Get action symbol for display
const getActionSymbol = (action) => {
  switch (action.action) {
    case 'fold': return 'F';
    case 'check': return 'X';
    case 'call': {
      // Show call amount in BB with 1 decimal precision
      if (action.call_amount && action.call_amount > 0) {
        const bbAmount = (action.call_amount / BIG_BLIND).toFixed(1);
        return `C ${bbAmount}BB`;
      }
      return 'C';
    }
    case 'bet':
    case 'raise': {
      // For preflop, show raise in BB (e.g., "R 4BB")
      if (action.amount && action.street === 'preflop') {
        const bbAmount = Math.round(action.amount / BIG_BLIND);
        return `R ${bbAmount}BB`;
      }
      // For postflop, show as multiplier of current bet
      if (action.amount && action.current_bet && action.current_bet > 0) {
        const multiplier = Math.round(action.amount / action.current_bet);
        return `R ${multiplier}x`;
      }
      return 'R';
    }
    case 'allin': return 'A';
    default: return '?';
  }
};

// Get player actions grouped by street
const getPlayerActionsForPosition = (actionHistory, pos) => {
  if (!actionHistory || actionHistory.length === 0) return null;

  const playerActions = actionHistory.filter(a => a.position === pos);
  if (playerActions.length === 0) return null;

  const byStreet = {};
  playerActions.forEach(action => {
    const street = action.street || 'preflop';
    const streetKey = street[0].toUpperCase();
    if (!byStreet[streetKey]) byStreet[streetKey] = [];
    byStreet[streetKey].push(action);
  });

  return byStreet;
};

export default function Seat({ player, emptyPlayerData, seatIndex, isActive, isDealer, actionHistory, position, isEmpty, hasFolded }) {
  // Get actions for this position from backend action history
  const positionActions = getPlayerActionsForPosition(actionHistory, position);

  // Render empty seat (non-active player)
  if (isEmpty) {
    const stack = emptyPlayerData?.stack ?? 1000;
    const currentBet = emptyPlayerData?.current_bet ?? 0;

    return (
      <div className={`player-seat seat-${seatIndex}`}>
        {isDealer && <div className="dealer-button">D</div>}
        {hasFolded ? (
          // Folded - show dashed card backs
          <div className="cards small folded-cards">
            <div className="cards">
              <div className="card facedown folded" />
              <div className="card facedown folded" />
            </div>
          </div>
        ) : (
          // Not yet acted - show solid card backs
          <div className="cards small in-hand">
            <div className="cards">
              <div className="card facedown" />
              <div className="card facedown" />
            </div>
          </div>
        )}
        <div className={`player-info${hasFolded ? ' folded' : ''}${isActive ? ' active' : ''}`}>
          <span className="player-position">{position}</span>
          <span className="player-name">Villain</span>
          <span className="player-stack">${stack}</span>
        </div>
        {currentBet > 0 && (
          <div className="player-bet">${currentBet}</div>
        )}
        {/* Action tracking for empty seats */}
        {positionActions && Object.keys(positionActions).length > 0 && (
          <div className="action-history">
            {Object.entries(positionActions).map(([street, actions]) => (
              <div key={street} className="action-street">
                <span className="street-label">{street}:</span>
                {actions.map((action, i) => (
                  <span key={i} className={`action-symbol action-${action.action}`}>
                    {getActionSymbol(action)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!player) return null;

  const isHero = player.is_hero || player.is_human;
  const playerFolded = player.folded || !player.is_active;
  const cards = player.cards || player.hole_cards;

  // Build class names
  const seatClasses = ['player-seat', `seat-${seatIndex}`].join(' ');

  const infoClasses = [
    'player-info',
    isActive && 'active',
    playerFolded && 'folded',
    isHero && 'hero'
  ].filter(Boolean).join(' ');

  const cardsClasses = [
    'cards',
    !isHero && 'small',
    !playerFolded && !isHero && 'in-hand',
    playerFolded && 'folded-cards'
  ].filter(Boolean).join(' ');

  return (
    <div className={seatClasses}>
      {/* Dealer button */}
      {isDealer && (
        <div className="dealer-button">D</div>
      )}

      {/* Cards */}
      <div className={cardsClasses}>
        {!playerFolded && (
          <div className="cards">
            {cards && cards[0] !== '??' ? (
              cards.map((card, i) => (
                <Card key={i} card={card} small={!isHero} />
              ))
            ) : (
              <>
                <div className={`card facedown`} />
                <div className={`card facedown`} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Player info */}
      <div className={infoClasses}>
        <span className="player-position">{player.position}</span>
        <span className={`player-name${!isHero ? ' clickable' : ''}`} title={!isHero ? 'Click to download range log' : ''}>
          {player.label || player.name || (isHero ? 'Hero' : 'Villain')}
        </span>
        <span className="player-stack">${player.stack}</span>
      </div>

      {/* Player bet - outside player info */}
      {player.current_bet > 0 && (
        <div className="player-bet">${player.current_bet}</div>
      )}

      {/* Action history */}
      {positionActions && Object.keys(positionActions).length > 0 && (
        <div className="action-history">
          {Object.entries(positionActions).map(([street, actions]) => (
            <div key={street} className="action-street">
              <span className="street-label">{street}:</span>
              {actions.map((action, i) => (
                <span
                  key={i}
                  className={`action-symbol action-${action.action}`}
                  title={`${action.action}${action.amount ? ` $${action.amount}` : ''}`}
                >
                  {getActionSymbol(action)}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

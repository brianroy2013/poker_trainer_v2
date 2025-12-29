import React from 'react';
import Card from '../Cards/Card';

export default function Seat({ player, emptyPlayerData, seatIndex, isActive, isDealer, actionHistory, position, isEmpty, hasFolded }) {
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
      </div>
    );
  }

  if (!player) return null;

  const isHero = player.is_hero || player.is_human;
  const playerFolded = player.folded || !player.is_active;
  const cards = player.cards || player.hole_cards;

  // Get action history for this player
  const getPlayerActions = () => {
    if (!actionHistory || actionHistory.length === 0) return null;

    const playerActions = actionHistory.filter(a => a.position === player.position);
    if (playerActions.length === 0) return null;

    // Group by street
    const byStreet = {};
    playerActions.forEach(action => {
      const street = action.street || 'preflop';
      const streetKey = street[0].toUpperCase(); // P, F, T, R
      if (!byStreet[streetKey]) byStreet[streetKey] = [];
      byStreet[streetKey].push(action);
    });

    return byStreet;
  };

  const playerActions = getPlayerActions();

  // Get action symbol
  const getActionSymbol = (action) => {
    switch (action.action) {
      case 'fold': return 'F';
      case 'check': return 'X';
      case 'call': return 'C';
      case 'bet':
      case 'raise': return 'R';
      case 'allin': return 'A';
      default: return '?';
    }
  };

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
      {playerActions && Object.keys(playerActions).length > 0 && (
        <div className="action-history">
          {Object.entries(playerActions).map(([street, actions]) => (
            <div key={street} className="action-street">
              <span className="street-label">{street}:</span>
              {actions.map((action, i) => (
                <span
                  key={i}
                  className={`action-symbol clickable action-${action.action}`}
                  title={`${action.action}${action.amount ? ` $${action.amount}` : ''} - Click to view range`}
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

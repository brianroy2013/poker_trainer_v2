import React from 'react';

export function ActionPanel({
  availableActions = [],
  pioActions = null,
  currentBet = 0,
  playerBet = 0,
  pot = 0,
  street = 'preflop',
  onAction,
  disabled = false
}) {
  const toCall = currentBet - playerBet;

  const handleAction = (action, amount = 0) => {
    if (disabled) return;
    onAction(action, amount);
  };

  if (availableActions.length === 0) {
    return (
      <div className="waiting">
        Waiting for opponent...
      </div>
    );
  }

  // Preflop: only Raise to 20 or Fold
  if (street === 'preflop') {
    return (
      <div className="action-buttons">
        <button
          className="action-btn raise"
          onClick={() => handleAction('raise', 20)}
          disabled={disabled}
        >
          Raise to 20
        </button>

        <button
          className="action-btn fold"
          onClick={() => handleAction('fold')}
          disabled={disabled}
        >
          Fold
        </button>
      </div>
    );
  }

  // Post-flop with PioSolver actions: show specific strategy options
  // Order: check/call first, then bets (smallest to largest), then fold
  if (pioActions && pioActions.length > 0) {
    // Bet colors: interpolate between light orange and dark red based on size
    const BET_COLOR_SMALL = { r: 233, g: 150, b: 122 };
    const BET_COLOR_LARGE = { r: 177, g: 91, b: 74 };

    const interpolateBetColor = (ratio) => {
      const r = Math.round(BET_COLOR_SMALL.r + (BET_COLOR_LARGE.r - BET_COLOR_SMALL.r) * ratio);
      const g = Math.round(BET_COLOR_SMALL.g + (BET_COLOR_LARGE.g - BET_COLOR_SMALL.g) * ratio);
      const b = Math.round(BET_COLOR_SMALL.b + (BET_COLOR_LARGE.b - BET_COLOR_SMALL.b) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    };

    // Get all bet actions and sort by amount
    const betActions = pioActions
      .filter(a => a.type === 'raise' && a.amount)
      .sort((a, b) => a.amount - b.amount);

    // Build color map for bets
    const betColorMap = {};
    if (betActions.length === 1) {
      betColorMap[betActions[0].amount] = interpolateBetColor(0);
    } else {
      betActions.forEach((bet, index) => {
        const ratio = index / (betActions.length - 1);
        betColorMap[bet.amount] = interpolateBetColor(ratio);
      });
    }

    const getActionOrder = (action) => {
      if (action.type === 'check' || action.type === 'call') return 0;
      if (action.type === 'raise') return 1 + (action.amount || 0); // Sort bets by size
      if (action.type === 'fold') return 100000;
      return 50000;
    };

    const sortedActions = [...pioActions].sort((a, b) => getActionOrder(a) - getActionOrder(b));

    return (
      <div className="action-buttons">
        {sortedActions.map((action, index) => {
          if (action.type === 'fold') {
            return (
              <button
                key={index}
                className="action-btn fold"
                onClick={() => handleAction('fold')}
                disabled={disabled}
              >
                Fold
              </button>
            );
          }
          if (action.type === 'check') {
            return (
              <button
                key={index}
                className="action-btn check-call"
                onClick={() => handleAction('check')}
                disabled={disabled}
              >
                Check
              </button>
            );
          }
          if (action.type === 'call') {
            return (
              <button
                key={index}
                className="action-btn check-call"
                onClick={() => handleAction('call')}
                disabled={disabled}
              >
                Call {toCall}
              </button>
            );
          }
          if (action.type === 'raise' && action.amount) {
            const betColor = betColorMap[action.amount] || interpolateBetColor(0.5);
            // Use 'total' for the action (PioSolver cumulative), display 'amount' (actual bet)
            const actionAmount = action.total || action.amount;
            return (
              <button
                key={index}
                className="action-btn raise"
                style={{ backgroundColor: betColor }}
                onClick={() => handleAction('raise', actionAmount)}
                disabled={disabled}
              >
                Bet {action.amount}
              </button>
            );
          }
          return null;
        })}
      </div>
    );
  }

  // Fallback to standard actions
  // Order: check/call first, then fold
  const canFold = availableActions.includes('fold');
  const canCheck = availableActions.includes('check');
  const canCall = availableActions.includes('call');

  return (
    <div className="action-buttons">
      {canCheck && (
        <button
          className="action-btn check-call"
          onClick={() => handleAction('check')}
          disabled={disabled}
        >
          Check
        </button>
      )}

      {canCall && (
        <button
          className="action-btn check-call"
          onClick={() => handleAction('call')}
          disabled={disabled}
        >
          Call {toCall}
        </button>
      )}

      {canFold && (
        <button
          className="action-btn fold"
          onClick={() => handleAction('fold')}
          disabled={disabled}
        >
          Fold
        </button>
      )}
    </div>
  );
}

export default ActionPanel;

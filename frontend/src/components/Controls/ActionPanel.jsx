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

  // Preflop: only Fold or Raise to 20
  if (street === 'preflop') {
    return (
      <div className="action-buttons">
        <button
          className="action-btn fold"
          onClick={() => handleAction('fold')}
          disabled={disabled}
        >
          Fold
        </button>

        <button
          className="action-btn raise"
          onClick={() => handleAction('raise', 20)}
          disabled={disabled}
        >
          Raise to 20
        </button>
      </div>
    );
  }

  // Post-flop with PioSolver actions: show specific strategy options
  if (pioActions && pioActions.length > 0) {
    return (
      <div className="action-buttons">
        {pioActions.map((action, index) => {
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
            const betLabel = action.amount <= pot * 0.4 ? 'Small' :
                            action.amount <= pot * 0.8 ? 'Medium' : 'Large';
            return (
              <button
                key={index}
                className="action-btn raise"
                onClick={() => handleAction('raise', action.amount)}
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
  const canFold = availableActions.includes('fold');
  const canCheck = availableActions.includes('check');
  const canCall = availableActions.includes('call');

  return (
    <div className="action-buttons">
      {canFold && (
        <button
          className="action-btn fold"
          onClick={() => handleAction('fold')}
          disabled={disabled}
        >
          Fold
        </button>
      )}

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
    </div>
  );
}

export default ActionPanel;

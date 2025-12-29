import React, { useState, useEffect } from 'react';

export function ActionPanel({
  availableActions = [],
  minRaise = 0,
  maxRaise = 0,
  currentBet = 0,
  playerBet = 0,
  pot = 0,
  onAction,
  disabled = false
}) {
  const [raiseAmount, setRaiseAmount] = useState(minRaise);

  const toCall = currentBet - playerBet;
  const canFold = availableActions.includes('fold');
  const canCheck = availableActions.includes('check');
  const canCall = availableActions.includes('call');
  const canRaise = availableActions.includes('raise') && maxRaise > minRaise;

  useEffect(() => {
    setRaiseAmount(minRaise);
  }, [minRaise]);

  const handleRaiseChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setRaiseAmount(Math.max(minRaise, Math.min(maxRaise, value)));
    }
  };

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

      {canRaise && (
        <div className="raise-input">
          <input
            type="number"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount}
            onChange={handleRaiseChange}
            placeholder={minRaise.toString()}
            disabled={disabled}
          />
          <button
            className="action-btn raise"
            onClick={() => handleAction('raise', raiseAmount)}
            disabled={disabled}
          >
            Raise
          </button>
        </div>
      )}
    </div>
  );
}

export default ActionPanel;

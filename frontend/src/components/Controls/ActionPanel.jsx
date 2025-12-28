import React, { useState, useEffect } from 'react';
import BetSlider from './BetSlider';
import PresetButtons from './PresetButtons';

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
  const [showRaiseControls, setShowRaiseControls] = useState(false);

  const toCall = currentBet - playerBet;
  const canRaise = availableActions.includes('raise') && maxRaise > minRaise;

  useEffect(() => {
    setRaiseAmount(minRaise);
  }, [minRaise]);

  const handleAction = (action, amount = 0) => {
    if (disabled) return;
    onAction(action, amount);
    setShowRaiseControls(false);
  };

  if (availableActions.length === 0) {
    return (
      <div className="text-center text-gray-400 py-4">
        Waiting for opponent...
      </div>
    );
  }

  return (
    <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
      {/* Main action buttons */}
      <div className="flex gap-3 justify-center mb-4">
        {/* Fold button */}
        {availableActions.includes('fold') && (
          <button
            onClick={() => handleAction('fold')}
            disabled={disabled}
            className="btn-action btn-fold min-w-[100px]"
          >
            Fold
          </button>
        )}

        {/* Check button */}
        {availableActions.includes('check') && (
          <button
            onClick={() => handleAction('check')}
            disabled={disabled}
            className="btn-action btn-check min-w-[100px]"
          >
            Check
          </button>
        )}

        {/* Call button */}
        {availableActions.includes('call') && (
          <button
            onClick={() => handleAction('call')}
            disabled={disabled}
            className="btn-action btn-call min-w-[100px]"
          >
            Call {toCall}
          </button>
        )}

        {/* Raise/Bet button */}
        {canRaise && (
          <button
            onClick={() => setShowRaiseControls(!showRaiseControls)}
            disabled={disabled}
            className={`btn-action btn-raise min-w-[100px] ${showRaiseControls ? 'ring-2 ring-amber-300' : ''}`}
          >
            {currentBet > 0 ? 'Raise' : 'Bet'}
          </button>
        )}
      </div>

      {/* Raise controls */}
      {showRaiseControls && canRaise && (
        <div className="border-t border-gray-700 pt-4 mt-2 space-y-4">
          {/* Preset buttons */}
          <PresetButtons
            pot={pot}
            minRaise={minRaise}
            maxRaise={maxRaise}
            onSelect={setRaiseAmount}
          />

          {/* Slider */}
          <BetSlider
            value={raiseAmount}
            min={minRaise}
            max={maxRaise}
            onChange={setRaiseAmount}
          />

          {/* Confirm raise button */}
          <button
            onClick={() => handleAction('raise', raiseAmount)}
            disabled={disabled}
            className="w-full py-3 rounded-lg font-bold text-lg bg-gradient-to-b from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] transition-all"
          >
            {currentBet > 0 ? `Raise to ${raiseAmount}` : `Bet ${raiseAmount}`}
          </button>
        </div>
      )}
    </div>
  );
}

export default ActionPanel;

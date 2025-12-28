import React from 'react';
import HoleCards from '../Cards/HoleCards';

const POSITION_STYLES = {
  'UTG': { top: '5%', left: '25%', transform: 'translate(-50%, 0)' },
  'MP': { top: '5%', right: '25%', transform: 'translate(50%, 0)' },
  'CO': { top: '50%', right: '2%', transform: 'translate(0, -50%)' },
  'BTN': { bottom: '5%', right: '25%', transform: 'translate(50%, 0)' },
  'SB': { bottom: '5%', left: '25%', transform: 'translate(-50%, 0)' },
  'BB': { top: '50%', left: '2%', transform: 'translate(0, -50%)' }
};

export function Seat({
  position,
  player,
  seatInfo,
  isActive,
  isActionOn,
  showDealer = false
}) {
  const style = POSITION_STYLES[position] || {};
  const isFolded = player?.folded;
  const hasPlayer = !!player;

  return (
    <div
      className={`
        absolute flex flex-col items-center gap-2 transition-all duration-300
        ${isFolded ? 'opacity-40' : 'opacity-100'}
        ${isActionOn ? 'scale-105' : ''}
      `}
      style={style}
    >
      {/* Player info box */}
      <div
        className={`
          relative px-4 py-2 rounded-xl min-w-[100px] text-center
          ${isActionOn
            ? 'bg-gradient-to-b from-amber-500/30 to-amber-700/30 border-2 border-amber-400 shadow-lg shadow-amber-500/20'
            : !isFolded
              ? 'bg-gradient-to-b from-gray-700/80 to-gray-800/80 border border-gray-600'
              : 'bg-gray-800/50 border border-gray-700/50'
          }
        `}
      >
        {/* Position label */}
        <div className="text-xs text-gray-400 mb-1">
          {position}
          {player?.label && player.label !== position && (
            <span className="ml-1 text-cyan-400 font-medium">
              ({player.label})
            </span>
          )}
        </div>

        {/* Stack */}
        {hasPlayer && (
          <div className="text-lg font-bold text-white">
            {player.stack.toLocaleString()}
          </div>
        )}

        {/* Current bet indicator */}
        {player?.current_bet > 0 && !isFolded && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-amber-500/90 text-black text-xs font-bold px-2 py-0.5 rounded-full">
            {player.current_bet}
          </div>
        )}

        {/* Dealer button */}
        {showDealer && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-black shadow-md">
            D
          </div>
        )}

        {/* Human indicator */}
        {player?.is_human && (
          <div className="absolute -top-2 -left-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md">
            U
          </div>
        )}
      </div>

      {/* Hole cards - show face down for all players, face up only for human */}
      {player?.hole_cards && !isFolded && (
        <div className="mt-1">
          <HoleCards
            cards={player.hole_cards}
            size="sm"
            faceDown={player.hole_cards[0] === '??'}
          />
        </div>
      )}

      {/* Folded cards - greyed out */}
      {player?.hole_cards && isFolded && (
        <div className="mt-1 opacity-30">
          <HoleCards
            cards={['??', '??']}
            size="sm"
            faceDown={true}
          />
        </div>
      )}

      {/* Folded indicator */}
      {isFolded && (
        <div className="text-xs text-red-400 font-medium">FOLDED</div>
      )}
    </div>
  );
}

export default Seat;

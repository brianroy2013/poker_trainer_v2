import React from 'react';
import Seat from './Seat';
import CommunityCards from '../Display/CommunityCards';
import PotDisplay from '../Display/PotDisplay';

const POSITIONS = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];

export function PokerTable({ gameState }) {
  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400 text-xl">Start a new hand to begin</div>
      </div>
    );
  }

  const { players, seats, action_on, community_cards, pot, street } = gameState;

  return (
    <div className="relative w-full max-w-4xl mx-auto aspect-[16/10]">
      {/* Table felt */}
      <div
        className="absolute inset-0 rounded-[50%] felt-texture shadow-2xl"
        style={{
          border: '12px solid #4a3728',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5)'
        }}
      />

      {/* Rail/rim detail */}
      <div
        className="absolute inset-0 rounded-[50%] pointer-events-none"
        style={{
          border: '12px solid transparent',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(0,0,0,0.2) 100%) border-box',
          WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude'
        }}
      />

      {/* Center area - community cards and pot */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        {/* Street indicator */}
        <div className="text-sm font-medium text-gray-300 uppercase tracking-wider">
          {street}
        </div>

        {/* Community cards */}
        <CommunityCards cards={community_cards} street={street} />

        {/* Pot display */}
        <PotDisplay pot={pot} />
      </div>

      {/* Player seats */}
      {POSITIONS.map((position) => (
        <Seat
          key={position}
          position={position}
          player={players[position]}
          seatInfo={seats[position]}
          isActive={seats[position]?.active}
          isActionOn={action_on === position}
          showDealer={position === 'BTN'}
        />
      ))}

      {/* Winner announcement */}
      {gameState.hand_complete && gameState.winner && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/80 backdrop-blur-sm px-8 py-4 rounded-2xl border-2 border-amber-400 shadow-lg shadow-amber-500/30">
            <div className="text-2xl font-bold text-amber-400">
              {players[gameState.winner]?.label || gameState.winner} Wins!
            </div>
            <div className="text-center text-gray-300 text-sm mt-1">
              Pot: {pot.toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PokerTable;

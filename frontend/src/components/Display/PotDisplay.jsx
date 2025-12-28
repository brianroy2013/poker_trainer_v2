import React from 'react';

export function PotDisplay({ pot = 0 }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Chip stack visual */}
      <div className="relative chip-stack">
        {pot > 0 && (
          <div className="flex gap-0.5">
            {[...Array(Math.min(5, Math.ceil(pot / 200)))].map((_, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full"
                style={{
                  background: 'linear-gradient(145deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
                  border: '2px dashed rgba(255,255,255,0.4)',
                  transform: `translateY(${i * -2}px)`
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pot amount */}
      <div className="bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full border border-gray-600">
        <span className="text-gray-400 text-sm mr-1">Pot:</span>
        <span className="text-white font-bold">{pot.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default PotDisplay;

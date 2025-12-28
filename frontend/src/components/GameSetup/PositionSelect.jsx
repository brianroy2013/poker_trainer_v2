import React from 'react';

export function PositionSelect({ onSelect, disabled = false }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          Choose Your Position
        </h2>
        <p className="text-gray-400 text-center mb-8">
          Select which seat you want to play from
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* Button (IP) */}
          <button
            onClick={() => onSelect('BTN')}
            disabled={disabled}
            className="group p-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 hover:border-cyan-500 transition-all hover:scale-105 active:scale-100"
          >
            <div className="text-4xl mb-3">
              <span className="inline-block group-hover:animate-bounce">D</span>
            </div>
            <div className="text-xl font-bold text-white mb-1">Button</div>
            <div className="text-cyan-400 font-medium">IP</div>
            <div className="text-xs text-gray-500 mt-2">In Position</div>
          </button>

          {/* Big Blind (OOP) */}
          <button
            onClick={() => onSelect('BB')}
            disabled={disabled}
            className="group p-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 hover:border-purple-500 transition-all hover:scale-105 active:scale-100"
          >
            <div className="text-4xl mb-3">
              <span className="inline-block group-hover:animate-bounce">BB</span>
            </div>
            <div className="text-xl font-bold text-white mb-1">Big Blind</div>
            <div className="text-purple-400 font-medium">OOP</div>
            <div className="text-xs text-gray-500 mt-2">Out of Position</div>
          </button>
        </div>

        <p className="text-gray-500 text-sm text-center mt-6">
          Heads-up: Only BTN and BB will play, others fold
        </p>
      </div>
    </div>
  );
}

export default PositionSelect;

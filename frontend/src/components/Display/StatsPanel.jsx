import React from 'react';

export function StatsPanel({ stats, currentBet, playerBet }) {
  if (!stats) return null;

  const toCall = stats.to_call || 0;

  return (
    <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
        Statistics
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Pot Odds */}
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Pot Odds</div>
          <div className="text-lg font-bold text-cyan-400">
            {stats.pot_odds}
          </div>
        </div>

        {/* SPR */}
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">SPR</div>
          <div className="text-lg font-bold text-purple-400">
            {stats.spr}
          </div>
        </div>

        {/* To Call */}
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">To Call</div>
          <div className="text-lg font-bold text-green-400">
            {toCall > 0 ? toCall.toLocaleString() : '-'}
          </div>
        </div>

        {/* Call % of Pot */}
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Call % Pot</div>
          <div className="text-lg font-bold text-amber-400">
            {stats.call_percent_pot > 0 ? `${stats.call_percent_pot}%` : '-'}
          </div>
        </div>
      </div>

      {/* Effective Pot */}
      <div className="mt-3 bg-gray-900/50 rounded-lg p-3">
        <div className="text-xs text-gray-500 mb-1">Effective Pot</div>
        <div className="text-lg font-bold text-white">
          {stats.effective_pot?.toLocaleString() || 0}
        </div>
      </div>
    </div>
  );
}

export default StatsPanel;

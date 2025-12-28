import React from 'react';

export function HandStrength({ strength }) {
  if (!strength) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900/95 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-600 shadow-lg">
      <span className="text-white font-medium">{strength}</span>
    </div>
  );
}

export default HandStrength;

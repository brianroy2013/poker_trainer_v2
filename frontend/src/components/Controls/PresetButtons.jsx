import React from 'react';

export function PresetButtons({ pot, minRaise, maxRaise, onSelect }) {
  const presets = [
    { label: '1/3', multiplier: 1/3 },
    { label: '1/2', multiplier: 1/2 },
    { label: '2/3', multiplier: 2/3 },
    { label: 'Pot', multiplier: 1 },
    { label: 'All-In', value: maxRaise }
  ];

  const calculateValue = (preset) => {
    if (preset.value !== undefined) {
      return preset.value;
    }
    const value = Math.round(pot * preset.multiplier);
    return Math.max(minRaise, Math.min(value, maxRaise));
  };

  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {presets.map((preset) => {
        const value = calculateValue(preset);
        const isDisabled = value < minRaise || minRaise >= maxRaise;

        return (
          <button
            key={preset.label}
            onClick={() => onSelect(value)}
            disabled={isDisabled}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${isDisabled
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600 hover:text-white active:scale-95'
              }
            `}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}

export default PresetButtons;

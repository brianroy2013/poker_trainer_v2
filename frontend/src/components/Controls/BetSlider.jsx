import React from 'react';

export function BetSlider({ value, min, max, onChange }) {
  const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className="w-full">
      <div className="relative pt-1">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
          style={{
            background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${percentage}%, #374151 ${percentage}%, #374151 100%)`
          }}
        />
      </div>

      {/* Current value display */}
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs text-gray-500">Min: {min}</span>
        <div className="bg-gray-900 border border-amber-500/50 rounded-lg px-4 py-2">
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const newValue = Number(e.target.value);
              if (newValue >= min && newValue <= max) {
                onChange(newValue);
              }
            }}
            className="bg-transparent text-center text-xl font-bold text-amber-400 w-24 outline-none"
            min={min}
            max={max}
          />
        </div>
        <span className="text-xs text-gray-500">Max: {max}</span>
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          background: linear-gradient(145deg, #fbbf24, #f59e0b);
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        input[type="range"]::-moz-range-thumb {
          width: 24px;
          height: 24px;
          background: linear-gradient(145deg, #fbbf24, #f59e0b);
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}

export default BetSlider;

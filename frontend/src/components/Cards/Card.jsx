import React from 'react';

const SUIT_SYMBOLS = {
  h: { symbol: '\u2665', name: 'hearts', color: '#dc2626' },
  d: { symbol: '\u2666', name: 'diamonds', color: '#dc2626' },
  c: { symbol: '\u2663', name: 'clubs', color: '#1f2937' },
  s: { symbol: '\u2660', name: 'spades', color: '#1f2937' }
};

const RANK_DISPLAY = {
  'T': '10',
  'J': 'J',
  'Q': 'Q',
  'K': 'K',
  'A': 'A'
};

export function Card({ card, size = 'md', faceDown = false }) {
  const sizes = {
    sm: { width: 40, height: 56, fontSize: 12, suitSize: 14 },
    md: { width: 56, height: 80, fontSize: 16, suitSize: 20 },
    lg: { width: 72, height: 100, fontSize: 20, suitSize: 28 }
  };

  const s = sizes[size] || sizes.md;

  if (faceDown || !card || card === '??') {
    return (
      <div
        className="rounded-lg card-shadow flex items-center justify-center"
        style={{
          width: s.width,
          height: s.height,
          background: 'linear-gradient(135deg, #1e40af 0%, #3730a3 50%, #1e3a8a 100%)',
          border: '2px solid #60a5fa'
        }}
      >
        <div className="text-blue-300 opacity-50" style={{ fontSize: s.suitSize }}>
          {'\u2660'}
        </div>
      </div>
    );
  }

  const rank = card[0];
  const suit = card[1];
  const suitInfo = SUIT_SYMBOLS[suit] || SUIT_SYMBOLS.s;
  const displayRank = RANK_DISPLAY[rank] || rank;

  return (
    <div
      className="rounded-lg card-shadow relative overflow-hidden"
      style={{
        width: s.width,
        height: s.height,
        background: 'linear-gradient(145deg, #ffffff 0%, #f5f5f5 50%, #e8e8e8 100%)',
        border: '1px solid #d1d5db'
      }}
    >
      {/* Top left rank and suit */}
      <div
        className="absolute top-1 left-1 flex flex-col items-center leading-none"
        style={{ color: suitInfo.color }}
      >
        <span style={{ fontSize: s.fontSize, fontWeight: 700 }}>{displayRank}</span>
        <span style={{ fontSize: s.suitSize * 0.7 }}>{suitInfo.symbol}</span>
      </div>

      {/* Center suit */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ color: suitInfo.color }}
      >
        <span style={{ fontSize: s.suitSize * 1.5 }}>{suitInfo.symbol}</span>
      </div>

      {/* Bottom right rank and suit (inverted) */}
      <div
        className="absolute bottom-1 right-1 flex flex-col items-center leading-none rotate-180"
        style={{ color: suitInfo.color }}
      >
        <span style={{ fontSize: s.fontSize, fontWeight: 700 }}>{displayRank}</span>
        <span style={{ fontSize: s.suitSize * 0.7 }}>{suitInfo.symbol}</span>
      </div>
    </div>
  );
}

export default Card;

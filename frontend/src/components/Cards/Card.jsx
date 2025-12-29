import React from 'react';

const SUIT_SYMBOLS = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠'
};

// Red suits: hearts and diamonds
const isRedSuit = (suit) => suit === 'h' || suit === 'd';

export default function Card({ card, faceDown = false, small = false }) {
  if (faceDown || !card || card === '??') {
    return (
      <div className={`card facedown${small ? ' small' : ''}`} />
    );
  }

  const rank = card[0];
  const suit = card[1];
  const symbol = SUIT_SYMBOLS[suit];
  const colorClass = isRedSuit(suit) ? 'red' : 'black';

  return (
    <div className={`card ${colorClass}`}>
      <span className="rank">{rank}</span>
      <span className="suit">{symbol}</span>
    </div>
  );
}

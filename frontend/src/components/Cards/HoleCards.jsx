import React from 'react';
import Card from './Card';

export function HoleCards({ cards, size = 'md', faceDown = false }) {
  if (!cards || cards.length < 2) {
    return null;
  }

  return (
    <div className="flex gap-1">
      <Card card={cards[0]} size={size} faceDown={faceDown} />
      <Card card={cards[1]} size={size} faceDown={faceDown} />
    </div>
  );
}

export default HoleCards;

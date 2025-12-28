import React from 'react';
import Card from '../Cards/Card';

export function CommunityCards({ cards = [], street }) {
  const placeholders = 5 - (cards?.length || 0);

  return (
    <div className="flex gap-2 justify-center">
      {cards.map((card, i) => (
        <Card key={i} card={card} size="lg" />
      ))}
      {[...Array(placeholders)].map((_, i) => (
        <div
          key={`placeholder-${i}`}
          className="rounded-lg opacity-20"
          style={{
            width: 72,
            height: 100,
            border: '2px dashed rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.05)'
          }}
        />
      ))}
    </div>
  );
}

export default CommunityCards;

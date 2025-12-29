import React from 'react';
import Card from '../Cards/Card';

export function CommunityCards({ cards = [], street }) {
  if (!cards || cards.length === 0) {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      justifyContent: 'center'
    }}>
      {cards.map((card, i) => (
        <Card key={i} card={card} size="md" />
      ))}
    </div>
  );
}

export default CommunityCards;

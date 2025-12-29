import React from 'react';

export function PotDisplay({ pot = 0, bigBlind = 100 }) {
  const potInBB = (pot / bigBlind).toFixed(1);

  return (
    <div
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: '8px 20px',
        borderRadius: 20,
        color: '#ffc107',
        fontSize: 18,
        fontWeight: 'bold'
      }}
    >
      Pot: {potInBB} BB
    </div>
  );
}

export default PotDisplay;

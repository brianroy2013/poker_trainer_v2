import React, { useState, useEffect, useRef } from 'react';
import Seat from './Seat';
import Card from '../Cards/Card';

// Position order around the table (clockwise from seat 0)
const POSITION_ORDER = ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'];

// Preflop action order (UTG acts first, then clockwise)
const PREFLOP_ACTION_ORDER = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];

export default function PokerTable({ gameState, onHeroCanAct, onComputerAction }) {
  const [visualActionOn, setVisualActionOn] = useState(null);
  const [foldedPositions, setFoldedPositions] = useState(new Set());
  const [preflopDone, setPreflopDone] = useState(false);
  const handIdRef = useRef(null);

  const board = gameState?.board || gameState?.community_cards || [];
  const pot = gameState?.pot || 0;
  const street = gameState?.street || 'preflop';
  const heroPosition = gameState?.human_position;
  const villainPosition = gameState?.villain_position;

  // Reset state when a new hand starts
  useEffect(() => {
    if (!gameState) return;

    const currentHandId = `${heroPosition}-${villainPosition}-${gameState.hand_id || Date.now()}`;

    if (handIdRef.current !== currentHandId) {
      handIdRef.current = currentHandId;
      setFoldedPositions(new Set());
      setPreflopDone(false);
      // Start action at UTG
      setVisualActionOn('UTG');
      // Hero can't act until visual action reaches them
      onHeroCanAct?.(false);
    }
  }, [gameState, heroPosition, villainPosition, onHeroCanAct]);

  // Sync foldedPositions with backend action_history (for folds that happen after hero acts)
  useEffect(() => {
    if (!gameState?.action_history) return;

    const foldedFromHistory = gameState.action_history
      .filter(a => a.action === 'fold')
      .map(a => a.position);

    if (foldedFromHistory.length > 0) {
      setFoldedPositions(prev => {
        const newSet = new Set(prev);
        foldedFromHistory.forEach(pos => newSet.add(pos));
        return newSet;
      });
    }
  }, [gameState?.action_history]);

  // Handle preflop action progression
  useEffect(() => {
    if (!gameState || preflopDone || !visualActionOn) return;
    if (street !== 'preflop') {
      setPreflopDone(true);
      onHeroCanAct?.(true);
      return;
    }

    const isHero = visualActionOn === heroPosition;
    const isVillain = visualActionOn === villainPosition;

    // If it's hero's turn, wait for their action (handled by parent)
    if (isHero) {
      onHeroCanAct?.(true);
      return;
    }

    // If it's villain's turn, they call/check - move to next
    // If it's a non-active player, they fold after delay
    const delay = isVillain ? 500 : 500;

    const timer = setTimeout(async () => {
      // Update visual fold state (for card animation)
      if (!isVillain) {
        setFoldedPositions(prev => new Set([...prev, visualActionOn]));
      }

      // Trigger backend API to record the action
      await onComputerAction?.();

      // Move to next position in preflop order
      const currentIndex = PREFLOP_ACTION_ORDER.indexOf(visualActionOn);
      const nextIndex = (currentIndex + 1) % 6;
      const nextPosition = PREFLOP_ACTION_ORDER[nextIndex];

      // If next position is hero, preflop visual is complete
      if (nextPosition === heroPosition) {
        setPreflopDone(true);
        setVisualActionOn(null);
        onHeroCanAct?.(true);
      } else {
        setVisualActionOn(nextPosition);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [visualActionOn, gameState, heroPosition, villainPosition, street, preflopDone, onHeroCanAct, onComputerAction]);

  if (!gameState) {
    return (
      <div className="poker-table" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff' }}>Loading...</span>
      </div>
    );
  }

  // Calculate rotation so hero is always at seat 0
  const heroPositionIndex = POSITION_ORDER.indexOf(heroPosition);
  const rotationOffset = heroPositionIndex;

  // Build all 6 seats with rotated positions
  const getAllSeats = () => {
    const seats = [];

    for (let seatIndex = 0; seatIndex < 6; seatIndex++) {
      // Calculate which position sits at this seat (reverse of getSeatForPosition)
      const positionIndex = (seatIndex + rotationOffset) % 6;
      const position = POSITION_ORDER[positionIndex];

      const isHeroSeat = position === heroPosition;
      const isVillainSeat = position === villainPosition;
      const player = gameState.players?.[position];
      const hasFolded = foldedPositions.has(position);

      seats.push({
        seatIndex,
        position,
        player: (isHeroSeat || isVillainSeat) ? {
          ...player,
          position,
          cards: player?.hole_cards || player?.cards,
          current_bet: player?.current_bet || 0,
        } : null,
        // Pass actual player data for empty seats (for blinds display)
        emptyPlayerData: (!isHeroSeat && !isVillainSeat) ? {
          stack: player?.stack || 1000,
          current_bet: player?.current_bet || 0,
        } : null,
        isEmpty: !isHeroSeat && !isVillainSeat,
        hasFolded,
        isDealer: position === 'BTN'
      });
    }

    return seats;
  };

  const allSeats = getAllSeats();

  // During preflop progression, show visual action; otherwise use game state
  const displayActionOn = !preflopDone && street === 'preflop' ? visualActionOn : gameState.action_on;

  return (
    <div className="poker-table">
      {/* Board area with community cards and pot */}
      <div className="board-area">
        <div className="board-cards">
          {board.length > 0 ? (
            board.map((card, i) => (
              <Card key={i} card={card} />
            ))
          ) : (
            // Empty card placeholders
            [0, 1, 2, 3, 4].map(i => (
              <div key={i} className="card empty" />
            ))
          )}
        </div>
        <div className="pot-display">
          Pot: <span className="pot-amount">${pot}</span>
          <span style={{ marginLeft: 12, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {street.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Render all 6 seats */}
      {allSeats.map((seat) => (
        <Seat
          key={seat.seatIndex}
          player={seat.player}
          emptyPlayerData={seat.emptyPlayerData}
          seatIndex={seat.seatIndex}
          position={seat.position}
          isEmpty={seat.isEmpty}
          hasFolded={seat.hasFolded}
          isActive={displayActionOn === seat.position}
          isDealer={seat.isDealer}
          actionHistory={gameState.action_history}
        />
      ))}

      {/* Winner announcement overlay */}
      {gameState.hand_complete && gameState.winner && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0,0,0,0.85)',
          padding: '20px 40px',
          borderRadius: 16,
          border: '2px solid var(--gold)',
          zIndex: 50,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--gold)' }}>
            {gameState.players[gameState.winner]?.label || gameState.winner} Wins!
          </div>
          <div style={{ color: '#ccc', fontSize: 18, marginTop: 8 }}>
            Pot: ${pot}
          </div>
        </div>
      )}
    </div>
  );
}

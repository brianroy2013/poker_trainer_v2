import { useState, useCallback, useRef } from 'react';
import gameApi from '../services/api';

const COMPUTER_ACTION_DELAY = 800; // ms between computer actions

export function useGameState() {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processingComputer, setProcessingComputer] = useState(false);
  const abortRef = useRef(false);

  const processComputerActions = useCallback(async () => {
    setProcessingComputer(true);
    abortRef.current = false;

    const processNext = async () => {
      if (abortRef.current) return;

      try {
        const state = await gameApi.computerAction();
        setGameState(state);

        // If action was taken and it's still computer's turn, continue after delay
        if (state.action_taken && !state.hand_complete) {
          const nextPlayer = state.players[state.action_on];
          if (nextPlayer && !nextPlayer.is_human) {
            await new Promise(resolve => setTimeout(resolve, COMPUTER_ACTION_DELAY));
            if (!abortRef.current) {
              await processNext();
            }
          }
        }
      } catch (err) {
        if (!abortRef.current) {
          setError(err.response?.data?.error || 'Failed to process computer action');
        }
      }
    };

    await processNext();
    setProcessingComputer(false);
  }, []);

  const startNewGame = useCallback(async (heroPosition = 'BTN', villainPosition = 'BB') => {
    abortRef.current = true; // Stop any pending computer actions
    setLoading(true);
    setError(null);
    try {
      const state = await gameApi.newGame(heroPosition, villainPosition);
      console.log('Selected PIO file:', state.pio_file);
      setGameState(state);
      setLoading(false);

      // Start processing computer actions with animation
      const firstPlayer = state.players[state.action_on];
      if (firstPlayer && !firstPlayer.is_human && !state.hand_complete) {
        await new Promise(resolve => setTimeout(resolve, COMPUTER_ACTION_DELAY));
        await processComputerActions();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start game');
      setLoading(false);
    }
  }, [processComputerActions]);

  const submitAction = useCallback(async (action, amount = 0) => {
    setLoading(true);
    setError(null);
    try {
      const state = await gameApi.submitAction(action, amount);
      setGameState(state);
      setLoading(false);

      // Process computer responses with animation
      const nextPlayer = state.players[state.action_on];
      if (nextPlayer && !nextPlayer.is_human && !state.hand_complete) {
        await new Promise(resolve => setTimeout(resolve, COMPUTER_ACTION_DELAY));
        await processComputerActions();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit action');
      setLoading(false);
    }
  }, [processComputerActions]);

  const resetGame = useCallback(async (heroPosition, villainPosition) => {
    abortRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const state = await gameApi.resetGame(heroPosition, villainPosition);
      setGameState(state);
      setLoading(false);

      // Start processing computer actions with animation
      const firstPlayer = state.players[state.action_on];
      if (firstPlayer && !firstPlayer.is_human && !state.hand_complete) {
        await new Promise(resolve => setTimeout(resolve, COMPUTER_ACTION_DELAY));
        await processComputerActions();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset game');
      setLoading(false);
    }
  }, [processComputerActions]);

  // Trigger a single computer action (called by PokerTable during visual animation)
  const triggerComputerAction = useCallback(async () => {
    try {
      const state = await gameApi.computerAction();
      setGameState(state);
      return state;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process computer action');
      return null;
    }
  }, []);

  const isHumanTurn = gameState &&
    gameState.action_on &&
    gameState.players[gameState.action_on]?.is_human &&
    !gameState.hand_complete &&
    !processingComputer;

  return {
    gameState,
    loading,
    error,
    processingComputer,
    startNewGame,
    submitAction,
    resetGame,
    triggerComputerAction,
    isHumanTurn
  };
}

export default useGameState;

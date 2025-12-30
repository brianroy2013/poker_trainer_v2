import random
from typing import Dict, Any, List, Tuple, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from game.game_state import GameState
    from game.pio_solver import PioSolverConnection


class ComputerPlayer:
    def __init__(self):
        self.pio: Optional['PioSolverConnection'] = None

    def set_pio_connection(self, pio: 'PioSolverConnection'):
        """Set the PioSolver connection for GTO strategy queries."""
        self.pio = pio

    def get_action(self, game_state: 'GameState') -> Dict[str, Any]:
        player = game_state.get_player_to_act()
        if not player or player.is_human:
            return {'action': None, 'amount': 0}

        from game.actions import ActionValidator
        validator = ActionValidator(game_state)
        available = validator.get_available_actions()

        # Non-active players (UTG, MP, CO, SB) always fold
        if not player.is_active:
            return {'action': 'fold', 'amount': 0}

        # Active computer player (villain) - use GTO strategy if available (from flop onwards)
        if self.pio and game_state.pio_node and game_state.street != 'preflop':
            gto_action = self._get_gto_action(game_state, player, available)
            if gto_action:
                return gto_action

        # Fallback to simple check/call strategy
        return self._fallback_action(game_state, available)

    def _get_gto_action(self, game_state: 'GameState', player, available: List[str]) -> Optional[Dict[str, Any]]:
        """Query PioSolver strategy and select action using weighted random."""
        try:
            # Get villain's hole cards as string
            if not player.hole_cards or len(player.hole_cards) < 2:
                return None
            hand = str(player.hole_cards[0]) + str(player.hole_cards[1])
            hand_idx = self.pio.get_hand_index(hand)
            if hand_idx < 0:
                print(f"[ComputerPlayer] Hand {hand} not found in hand_order", flush=True)
                return None

            # Get strategy at current node
            strategy = self.pio.show_strategy(game_state.pio_node)
            if not strategy:
                print(f"[ComputerPlayer] No strategy at node {game_state.pio_node}", flush=True)
                return None

            # Get children to understand available actions
            children = self.pio.show_children(game_state.pio_node)
            if not children:
                return None

            # Build action probabilities for this specific hand
            action_probs = []
            for child in children:
                action_str = child['action']
                if action_str in strategy:
                    freq = strategy[action_str][hand_idx]
                    if freq > 0:
                        action_probs.append((action_str, freq, child['node_id']))

            if not action_probs:
                print(f"[ComputerPlayer] No valid actions for hand {hand} at node {game_state.pio_node}", flush=True)
                return None

            # Weighted random selection
            selected_action, selected_node = self._weighted_select(action_probs)
            print(f"[ComputerPlayer] GTO selected: {selected_action} for hand {hand} (node: {game_state.pio_node})", flush=True)

            # Convert PioSolver action to game action
            return self._convert_pio_action(selected_action, game_state, available)

        except Exception as e:
            print(f"[ComputerPlayer] Error getting GTO action: {e}", flush=True)
            import traceback
            traceback.print_exc()
            return None

    def _weighted_select(self, action_probs: List[Tuple[str, float, str]]) -> Tuple[str, str]:
        """Select action based on frequency weights."""
        total = sum(prob for _, prob, _ in action_probs)
        if total == 0:
            return ('c', None)  # Default to check/call

        r = random.random() * total
        cumulative = 0
        for action, prob, node in action_probs:
            cumulative += prob
            if r <= cumulative:
                return (action, node)

        return action_probs[-1][0], action_probs[-1][2]

    def _convert_pio_action(self, pio_action: str, game_state: 'GameState', available: List[str]) -> Dict[str, Any]:
        """Convert PioSolver action notation to game action."""
        player = game_state.get_player_to_act()

        if pio_action == 'f':
            if 'fold' in available:
                return {'action': 'fold', 'amount': 0}

        elif pio_action == 'c':
            # Check or call depending on current bet
            if game_state.current_bet == player.current_bet:
                if 'check' in available:
                    return {'action': 'check', 'amount': 0}
            else:
                if 'call' in available:
                    call_amount = game_state.current_bet - player.current_bet
                    return {'action': 'call', 'amount': call_amount}

        elif pio_action.startswith('b'):
            # Bet or raise
            # PioSolver amount is cumulative for entire hand
            # Need to calculate actual bet for this action
            try:
                pio_total = int(pio_action[1:])

                # Determine if villain is OOP or IP
                # In heads-up BTN vs BB: BTN is IP, BB is OOP
                villain_pio_position = 'IP' if player.position == 'BTN' else 'OOP'

                # Get cumulative investment from node path
                player_invested = game_state._get_player_cumulative_invested(villain_pio_position)

                # Actual bet = PioSolver total - already invested
                actual_bet = pio_total - player_invested

                if 'raise' in available:
                    return {'action': 'raise', 'amount': actual_bet}
            except ValueError:
                pass

        # If the specific action isn't available, fall back
        return self._fallback_action(game_state, available)

    def _fallback_action(self, game_state: 'GameState', available: List[str]) -> Dict[str, Any]:
        """Fallback to simple check/call strategy."""
        player = game_state.get_player_to_act()

        if 'check' in available:
            return {'action': 'check', 'amount': 0}

        if 'call' in available:
            call_amount = game_state.current_bet - player.current_bet
            return {'action': 'call', 'amount': call_amount}

        return {'action': 'fold', 'amount': 0}

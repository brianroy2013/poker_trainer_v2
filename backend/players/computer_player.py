from typing import Dict, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from game.game_state import GameState


class ComputerPlayer:
    def __init__(self):
        pass

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

        # Active computer players (BB when human is BTN, or BTN when human is BB)
        # For v1: always call/check
        if 'check' in available:
            return {'action': 'check', 'amount': 0}

        if 'call' in available:
            call_amount = game_state.current_bet - player.current_bet
            return {'action': 'call', 'amount': call_amount}

        return {'action': 'fold', 'amount': 0}

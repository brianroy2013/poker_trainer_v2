from typing import List, TYPE_CHECKING

if TYPE_CHECKING:
    from .game_state import GameState


class ActionValidator:
    def __init__(self, game_state: 'GameState'):
        self.game = game_state

    def get_available_actions(self) -> List[str]:
        player = self.game.get_player_to_act()
        if not player or player.folded or player.all_in:
            return []

        actions = ['fold']

        if self.game.current_bet == player.current_bet:
            actions.append('check')
        else:
            actions.append('call')

        if player.stack > (self.game.current_bet - player.current_bet):
            actions.append('raise')

        return actions

    def validate_action(self, action: str, amount: int = 0) -> tuple[bool, str]:
        available = self.get_available_actions()

        if action not in available:
            return False, f"Action '{action}' not available. Available: {available}"

        if action == 'raise':
            player = self.game.get_player_to_act()
            min_raise = self.game.current_bet + self.game.min_raise
            max_raise = player.stack + player.current_bet

            if amount < min_raise and amount < max_raise:
                return False, f"Raise must be at least {min_raise}"
            if amount > max_raise:
                return False, f"Cannot raise more than {max_raise}"

        return True, ""

    def get_raise_bounds(self) -> tuple[int, int]:
        player = self.game.get_player_to_act()
        if not player:
            return 0, 0

        min_raise = self.game.current_bet + self.game.min_raise
        max_raise = player.stack + player.current_bet

        return min_raise, max_raise

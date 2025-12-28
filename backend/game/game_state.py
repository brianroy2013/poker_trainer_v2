import uuid
from typing import Dict, List, Optional, Any
from .deck import Deck, Card
from .actions import ActionValidator

POSITIONS = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB']
PREFLOP_ORDER = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB']
POSTFLOP_ORDER = ['SB', 'BB', 'UTG', 'MP', 'CO', 'BTN']
STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown']

BIG_BLIND = 10
SMALL_BLIND = 5
STARTING_STACK = 1000


class Player:
    def __init__(self, position: str, label: str, is_human: bool, is_active: bool = True, stack: int = STARTING_STACK):
        self.position = position
        self.label = label
        self.is_human = is_human
        self.is_active = is_active  # True for BTN/BB, False for others (will fold)
        self.stack = stack
        self.hole_cards: List[Card] = []
        self.current_bet = 0
        self.folded = False
        self.all_in = False
        self.acted_this_street = False

    def reset_for_new_hand(self):
        self.hole_cards = []
        self.current_bet = 0
        self.folded = False
        self.all_in = False
        self.acted_this_street = False
        self.stack = STARTING_STACK

    def reset_for_new_street(self):
        self.current_bet = 0
        self.acted_this_street = False

    def to_dict(self, hide_cards: bool = False) -> Dict[str, Any]:
        cards = None
        if self.hole_cards:
            if hide_cards:
                cards = ['??', '??']
            else:
                cards = [str(c) for c in self.hole_cards]

        return {
            'position': self.position,
            'label': self.label,
            'is_human': self.is_human,
            'is_active': self.is_active,
            'stack': self.stack,
            'hole_cards': cards,
            'current_bet': self.current_bet,
            'folded': self.folded,
            'all_in': self.all_in
        }


class GameState:
    def __init__(self):
        self.hand_id: str = ''
        self.deck = Deck()
        self.street: str = 'preflop'
        self.pot: int = 0
        self.community_cards: List[Card] = []
        self.players: Dict[str, Player] = {}
        self.action_on: str = ''
        self.last_aggressor: str = ''
        self.current_bet: int = 0
        self.min_raise: int = BIG_BLIND
        self.hand_complete: bool = False
        self.winner: Optional[str] = None
        self.human_position: str = ''

        self.seats: Dict[str, Dict] = {
            pos: {'active': False, 'folded': True}
            for pos in POSITIONS
        }

    def start_new_hand(self, human_position: str = 'BTN'):
        self.hand_id = str(uuid.uuid4())
        self.deck.reset()
        self.street = 'preflop'
        self.pot = 0
        self.community_cards = []
        self.current_bet = BIG_BLIND
        self.min_raise = BIG_BLIND
        self.hand_complete = False
        self.winner = None
        self.last_aggressor = 'BB'
        self.human_position = human_position

        # Create all 6 players - only BTN and BB are "active" (won't auto-fold)
        self.players = {}
        for pos in POSITIONS:
            if pos == 'BTN':
                is_human = (human_position == 'BTN')
                is_active = True
                label = 'IP'
            elif pos == 'BB':
                is_human = (human_position == 'BB')
                is_active = True
                label = 'OOP'
            else:
                is_human = False
                is_active = False  # Will fold when action reaches them
                label = pos

            self.players[pos] = Player(pos, label, is_human=is_human, is_active=is_active)

        # Initialize seats
        self.seats = {pos: {'active': True, 'folded': False} for pos in POSITIONS}

        # Post blinds
        self.players['SB'].stack -= SMALL_BLIND
        self.players['SB'].current_bet = SMALL_BLIND
        self.pot += SMALL_BLIND

        self.players['BB'].stack -= BIG_BLIND
        self.players['BB'].current_bet = BIG_BLIND
        self.pot += BIG_BLIND

        # Deal cards to all players
        for pos in POSITIONS:
            self.players[pos].hole_cards = self.deck.deal(2)

        # Preflop action starts at UTG
        self.action_on = 'UTG'

    def get_active_players(self) -> List[Player]:
        return [p for p in self.players.values() if not p.folded]

    def get_player_to_act(self) -> Optional[Player]:
        if self.action_on and self.action_on in self.players:
            return self.players[self.action_on]
        return None

    def is_betting_complete(self) -> bool:
        active = self.get_active_players()
        if len(active) <= 1:
            return True

        all_acted = all(p.acted_this_street or p.all_in for p in active)
        bets_equal = len(set(p.current_bet for p in active if not p.all_in)) <= 1

        return all_acted and bets_equal

    def advance_action(self):
        # Use appropriate position order based on street
        if self.street == 'preflop':
            order = PREFLOP_ORDER
        else:
            order = POSTFLOP_ORDER

        current_idx = order.index(self.action_on)

        # Find next player who can act
        for i in range(1, len(order) + 1):
            next_idx = (current_idx + i) % len(order)
            next_pos = order[next_idx]
            next_player = self.players[next_pos]

            if not next_player.folded and not next_player.all_in:
                self.action_on = next_pos
                return

        # No one left to act
        if self.is_betting_complete():
            self.advance_street()

    def advance_street(self):
        for p in self.players.values():
            self.pot += p.current_bet
            p.reset_for_new_street()

        self.current_bet = 0
        self.min_raise = BIG_BLIND

        current_idx = STREETS.index(self.street)
        if current_idx < len(STREETS) - 1:
            self.street = STREETS[current_idx + 1]

        if self.street == 'flop':
            self.community_cards = self.deck.deal(3)
        elif self.street == 'turn':
            self.community_cards.extend(self.deck.deal(1))
        elif self.street == 'river':
            self.community_cards.extend(self.deck.deal(1))
        elif self.street == 'showdown':
            self.resolve_showdown()
            return

        # Find first non-folded player in postflop order
        for pos in POSTFLOP_ORDER:
            player = self.players[pos]
            if not player.folded and not player.all_in:
                self.action_on = pos
                break

    def resolve_showdown(self):
        from .hand_evaluator import HandEvaluator

        active = self.get_active_players()
        if len(active) == 1:
            self.winner = active[0].position
        else:
            evaluator = HandEvaluator()
            best_hand = None
            best_player = None

            for player in active:
                all_cards = player.hole_cards + self.community_cards
                hand_rank = evaluator.evaluate(all_cards)

                if best_hand is None or hand_rank > best_hand:
                    best_hand = hand_rank
                    best_player = player

            self.winner = best_player.position if best_player else None

        if self.winner:
            self.players[self.winner].stack += self.pot

        self.hand_complete = True
        self.action_on = ''

    def process_action(self, action: str, amount: int = 0) -> Dict[str, Any]:
        player = self.get_player_to_act()
        if not player:
            return {'success': False, 'error': 'No player to act'}

        validator = ActionValidator(self)
        available = validator.get_available_actions()

        if action not in available:
            return {'success': False, 'error': f'Invalid action: {action}'}

        if action == 'fold':
            player.folded = True
            player.acted_this_street = True
            self.seats[player.position]['folded'] = True

            active = self.get_active_players()
            if len(active) == 1:
                self.winner = active[0].position
                self.players[self.winner].stack += self.pot
                for p in self.players.values():
                    self.pot += p.current_bet
                    p.current_bet = 0
                self.hand_complete = True
                self.action_on = ''
                return {'success': True}

        elif action == 'check':
            player.acted_this_street = True

        elif action == 'call':
            call_amount = self.current_bet - player.current_bet
            call_amount = min(call_amount, player.stack)
            player.stack -= call_amount
            player.current_bet += call_amount
            player.acted_this_street = True

            if player.stack == 0:
                player.all_in = True

        elif action == 'raise':
            if amount < self.min_raise + self.current_bet:
                amount = self.min_raise + self.current_bet

            if amount >= player.stack + player.current_bet:
                amount = player.stack + player.current_bet
                player.all_in = True

            raise_amount = amount - player.current_bet
            player.stack -= raise_amount

            raise_size = amount - self.current_bet
            self.min_raise = raise_size
            self.current_bet = amount
            player.current_bet = amount
            player.acted_this_street = True
            self.last_aggressor = player.position

            for p in self.players.values():
                if p.position != player.position and not p.folded and not p.all_in:
                    p.acted_this_street = False

        if not self.hand_complete:
            if self.is_betting_complete():
                self.advance_street()
            else:
                self.advance_action()

        return {'success': True}

    def get_stats(self) -> Dict[str, Any]:
        player = self.get_player_to_act()
        if not player:
            return {}

        to_call = self.current_bet - player.current_bet
        effective_pot = self.pot + sum(p.current_bet for p in self.players.values())

        pot_odds_ratio = 0
        if to_call > 0 and effective_pot > 0:
            pot_odds_ratio = effective_pot / to_call

        active_players = self.get_active_players()
        effective_stack = min(p.stack for p in active_players) if active_players else 0
        spr = effective_stack / effective_pot if effective_pot > 0 else 0

        call_percent = (to_call / effective_pot * 100) if effective_pot > 0 else 0

        return {
            'pot_odds': f"{pot_odds_ratio:.1f}:1" if pot_odds_ratio > 0 else "N/A",
            'spr': round(spr, 1),
            'to_call': to_call,
            'call_percent_pot': round(call_percent, 1),
            'effective_pot': effective_pot
        }

    def to_dict(self) -> Dict[str, Any]:
        player = self.get_player_to_act()
        validator = ActionValidator(self) if player else None

        human_pos = self.human_position
        players_dict = {}
        for pos, p in self.players.items():
            hide = not p.is_human and self.street != 'showdown' and not self.hand_complete
            players_dict[pos] = p.to_dict(hide_cards=hide)

        return {
            'hand_id': self.hand_id,
            'street': self.street,
            'pot': self.pot + sum(p.current_bet for p in self.players.values()),
            'community_cards': [str(c) for c in self.community_cards],
            'players': players_dict,
            'seats': self.seats,
            'action_on': self.action_on,
            'human_position': self.human_position,
            'available_actions': validator.get_available_actions() if validator else [],
            'min_raise': self.current_bet + self.min_raise,
            'max_raise': (player.stack + player.current_bet) if player else 0,
            'current_bet': self.current_bet,
            'stats': self.get_stats(),
            'hand_complete': self.hand_complete,
            'winner': self.winner
        }

import uuid
import os
import random
from typing import Dict, List, Optional, Any, Tuple
from .deck import Deck, Card, RANKS, SUITS
from .actions import ActionValidator
from .pio_solver import extract_oop_hands_to_file, extract_ip_hands_to_file, PioSolverConnection

POSITIONS = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB']


def load_oop_hands_from_file(file_path: str) -> List[Tuple[str, float]]:
    """Load OOP hands and frequencies from the extracted file."""
    hands = []
    try:
        with open(file_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('#') or not line:
                    continue
                parts = line.split(',')
                if len(parts) == 2:
                    hand = parts[0]
                    freq = float(parts[1])
                    hands.append((hand, freq))
    except Exception as e:
        print(f"[GameState] Error loading OOP hands: {e}", flush=True)
    return hands


def select_oop_hand(hands: List[Tuple[str, float]], available_cards: set) -> Optional[Tuple[str, float]]:
    """
    Select a hand from OOP range where both cards are available.
    Uses weighted random selection based on frequency.
    """
    # Filter hands where both cards are available
    valid_hands = []
    for hand, freq in hands:
        # Hand format is like "As9h" - first card is chars 0-1, second is chars 2-3
        card1 = hand[:2]
        card2 = hand[2:]
        if card1 in available_cards and card2 in available_cards:
            valid_hands.append((hand, freq))

    if not valid_hands:
        print("[GameState] No valid OOP hands found!", flush=True)
        return None

    # Weighted random selection
    total_weight = sum(freq for _, freq in valid_hands)
    r = random.random() * total_weight
    cumulative = 0
    for hand, freq in valid_hands:
        cumulative += freq
        if r <= cumulative:
            return (hand, freq)

    # Fallback to last hand
    return valid_hands[-1]


PREFLOP_ORDER = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB']
POSTFLOP_ORDER = ['SB', 'BB', 'UTG', 'MP', 'CO', 'BTN']
STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown']

BIG_BLIND = 5
SMALL_BLIND = 2
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
        self.action_history: List[Dict[str, Any]] = []
        self.pio_file: str = ''
        self.flop_cards: List[Card] = []
        self.available_cards: set = set()  # Tracks all available cards (52 - used cards)
        self.pio_node: str = 'r:0'  # Current position in PioSolver game tree
        self.pio_connection: Optional[PioSolverConnection] = None  # Reference to PioSolver

        self.seats: Dict[str, Dict] = {
            pos: {'active': False, 'folded': True}
            for pos in POSITIONS
        }

    def start_new_hand(self, hero_position: str = 'BTN', villain_position: str = 'BB'):
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
        self.human_position = hero_position
        self.villain_position = villain_position
        self.action_history = []
        self.pio_node = 'r:0'  # Reset to root node

        # Initialize available cards with all 52 cards
        self.available_cards = {f"{r}{s}" for r in RANKS for s in SUITS}

        # Use fixed test file for initial testing
        self.pio_file = r'W:\piosolves_for_hand_reading\10_flops\Qs8h7d.cfr'
        self.flop_cards = [
            Card.from_string('Qs'),
            Card.from_string('8h'),
            Card.from_string('7d')
        ]
        self.deck.remove_cards(self.flop_cards)

        # Remove flop cards from available cards
        for card in self.flop_cards:
            self.available_cards.discard(str(card))

        # Extract OOP and IP hands from the selected PioSolver file
        oop_hand_path = os.path.join(os.path.dirname(__file__), '..', '..', 'oop_hand.txt')
        ip_hand_path = os.path.join(os.path.dirname(__file__), '..', '..', 'ip_hand.txt')
        if self.pio_file:
            extract_oop_hands_to_file(self.pio_file, oop_hand_path)
            extract_ip_hands_to_file(self.pio_file, ip_hand_path)

        # Log available cards after PioSolver processing
        print(f"[GameState] PioSolver file loaded: {self.pio_file}", flush=True)
        print(f"[GameState] Flop cards: {[str(c) for c in self.flop_cards]}", flush=True)
        print(f"[GameState] Available cards ({len(self.available_cards)}): {sorted(self.available_cards)}", flush=True)

        # Select OOP hand (BB) from PioSolver range
        oop_hands = load_oop_hands_from_file(oop_hand_path)
        selected_oop = select_oop_hand(oop_hands, self.available_cards)
        if selected_oop:
            selected_hand, selected_freq = selected_oop
            print(f"[GameState] Selected OOP hand: {selected_hand} (frequency: {selected_freq:.6f})", flush=True)
            bb_cards = [Card.from_string(selected_hand[:2]), Card.from_string(selected_hand[2:])]
        else:
            print("[GameState] Falling back to hardcoded BB hand: As9h", flush=True)
            bb_cards = [Card.from_string('As'), Card.from_string('9h')]

        # Remove BB cards from available_cards
        for card in bb_cards:
            self.available_cards.discard(str(card))

        # Select IP hand (BTN) from PioSolver range
        ip_hands = load_oop_hands_from_file(ip_hand_path)  # Same file format
        selected_ip = select_oop_hand(ip_hands, self.available_cards)
        if selected_ip:
            selected_hand, selected_freq = selected_ip
            print(f"[GameState] Selected IP hand: {selected_hand} (frequency: {selected_freq:.6f})", flush=True)
            btn_cards = [Card.from_string(selected_hand[:2]), Card.from_string(selected_hand[2:])]
        else:
            print("[GameState] Falling back to hardcoded BTN hand: 7s8s", flush=True)
            btn_cards = [Card.from_string('7s'), Card.from_string('8s')]

        # Remove BTN cards from available_cards
        for card in btn_cards:
            self.available_cards.discard(str(card))

        # Create all 6 players - only hero and villain are "active" (won't auto-fold)
        self.players = {}
        for pos in POSITIONS:
            is_human = (pos == hero_position)
            is_active = (pos == hero_position or pos == villain_position)

            if pos == hero_position:
                label = 'Hero'
            elif pos == villain_position:
                label = 'Villain'
            else:
                label = pos

            self.players[pos] = Player(pos, label, is_human=is_human, is_active=is_active)

        # Initialize seats
        self.seats = {pos: {'active': True, 'folded': False} for pos in POSITIONS}

        # Post blinds (current_bet will be added to pot when street advances)
        self.players['SB'].stack -= SMALL_BLIND
        self.players['SB'].current_bet = SMALL_BLIND

        self.players['BB'].stack -= BIG_BLIND
        self.players['BB'].current_bet = BIG_BLIND

        # Remove cards from deck
        self.deck.remove_cards(bb_cards)
        self.deck.remove_cards(btn_cards)

        # Deal cards to players
        for pos in POSITIONS:
            if pos == 'BB':
                self.players[pos].hole_cards = bb_cards
            elif pos == 'BTN':
                self.players[pos].hole_cards = btn_cards
            else:
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
            # Use predetermined flop cards from PioSolver file if available
            if self.flop_cards:
                self.community_cards = self.flop_cards
            else:
                self.community_cards = self.deck.deal(3)
        elif self.street == 'turn':
            self.community_cards.extend(self.deck.deal(1))
            self._update_pio_node_for_street()
        elif self.street == 'river':
            self.community_cards.extend(self.deck.deal(1))
            self._update_pio_node_for_street()
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

        # Update PioSolver node tracking (only from flop onwards - trees start at flop)
        if self.street != 'preflop':
            child_node = self._find_child_node(action, amount)
            if child_node:
                self.pio_node = child_node

        # Calculate call amount for recording
        call_amount = None
        if action == 'call':
            call_amount = self.current_bet - player.current_bet
            call_amount = min(call_amount, player.stack)

        # Record action in history
        action_record = {
            'position': player.position,
            'action': action,
            'street': self.street,
            'amount': amount if action in ['raise', 'bet'] else None,
            'call_amount': call_amount,
            'current_bet': self.current_bet if action == 'raise' else None
        }
        self.action_history.append(action_record)

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

    def _find_child_node(self, action: str, amount: int = 0) -> Optional[str]:
        """
        Find the child node that matches the given action.

        Args:
            action: 'fold', 'check', 'call', or 'raise'
            amount: Raise amount (for raise actions)

        Returns:
            Child node string, or None if no match found
        """
        if not self.pio_connection or not self.pio_node:
            return None

        try:
            children = self.pio_connection.show_children(self.pio_node)
            if not children:
                return None

            if action == 'fold':
                for child in children:
                    if child['action'] == 'f':
                        return child['node_id']

            elif action in ('check', 'call'):
                for child in children:
                    if child['action'] == 'c':
                        return child['node_id']

            elif action == 'raise':
                # Find closest bet size match
                bet_children = []
                for child in children:
                    if child['action'].startswith('b'):
                        try:
                            size = int(child['action'][1:])
                            bet_children.append((size, child['node_id']))
                        except ValueError:
                            continue

                if bet_children:
                    # Find closest match to the actual bet amount
                    bet_children.sort(key=lambda x: abs(x[0] - amount))
                    return bet_children[0][1]

        except Exception as e:
            print(f"[GameState] Error finding child node: {e}", flush=True)

        return None

    def _update_pio_node_for_street(self):
        """Update pio_node when advancing to a new street (add card to path)."""
        if not self.pio_connection or not self.pio_node:
            return

        # Add the new card to the node path
        if self.street == 'turn' and len(self.community_cards) >= 4:
            turn_card = str(self.community_cards[3])
            self.pio_node = f"{self.pio_node}:{turn_card}"
        elif self.street == 'river' and len(self.community_cards) >= 5:
            river_card = str(self.community_cards[4])
            self.pio_node = f"{self.pio_node}:{river_card}"

    def _get_pio_actions(self) -> Optional[List[Dict]]:
        """
        Get available actions from PioSolver tree at current node.

        Returns:
            List of action dicts with 'type' and optionally 'amount' for bets/raises
            e.g., [{'type': 'check'}, {'type': 'raise', 'amount': 21}, {'type': 'raise', 'amount': 42}]
        """
        # Only use PioSolver actions from flop onwards
        if not self.pio_connection or not self.pio_node or self.street == 'preflop':
            return None

        try:
            children = self.pio_connection.show_children(self.pio_node)
            if not children:
                return None

            player = self.get_player_to_act()
            if not player:
                return None

            actions = []
            for child in children:
                pio_action = child['action']

                if pio_action == 'f':
                    actions.append({'type': 'fold'})
                elif pio_action == 'c':
                    # Check or call depending on current bet
                    if self.current_bet == player.current_bet:
                        actions.append({'type': 'check'})
                    else:
                        actions.append({'type': 'call'})
                elif pio_action.startswith('b'):
                    # Bet/raise with specific amount
                    try:
                        amount = int(pio_action[1:])
                        actions.append({'type': 'raise', 'amount': amount})
                    except ValueError:
                        continue

            return actions if actions else None

        except Exception as e:
            print(f"[GameState] Error getting PioSolver actions: {e}", flush=True)
            return None

    def _get_villain_strategy(self) -> Optional[Dict]:
        """Get villain's strategy at this node for display."""
        # Only show strategy from flop onwards (PioSolver trees start at flop)
        if not self.pio_connection or not self.pio_node or self.street == 'preflop':
            return None

        try:
            # Get strategy at current node
            strategy = self.pio_connection.show_strategy(self.pio_node)
            if not strategy:
                return None

            hand_order = self.pio_connection.hand_order
            if len(hand_order) != 1326:
                return None

            # Get the actions available at this node
            actions = list(strategy.keys())
            if not actions:
                return None

            # Build 13x13 strategy grid for each action
            RANKS_ORDER = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

            # For each cell, store the dominant action and its frequency
            grid = [[None] * 13 for _ in range(13)]

            for i, hand in enumerate(hand_order):
                if len(hand) != 4:
                    continue

                r1, s1, r2, s2 = hand[0], hand[1], hand[2], hand[3]
                if r1 not in RANKS_ORDER or r2 not in RANKS_ORDER:
                    continue

                row = RANKS_ORDER.index(r1)
                col = RANKS_ORDER.index(r2)

                # Suited hands above diagonal, offsuit below
                if s1 == s2:  # Suited
                    if row > col:
                        row, col = col, row
                else:  # Offsuit
                    if row < col:
                        row, col = col, row

                # Get action frequencies for this hand
                action_freqs = {}
                total_freq = 0
                for action, freqs in strategy.items():
                    if i < len(freqs):
                        freq = freqs[i]
                        if freq > 0:
                            action_freqs[action] = freq
                            total_freq += freq

                if total_freq > 0:
                    # Aggregate into this cell
                    if grid[row][col] is None:
                        grid[row][col] = {'actions': {}, 'count': 0}

                    for action, freq in action_freqs.items():
                        if action not in grid[row][col]['actions']:
                            grid[row][col]['actions'][action] = 0
                        grid[row][col]['actions'][action] += freq
                    grid[row][col]['count'] += 1

            # Average and normalize the frequencies
            for row in range(13):
                for col in range(13):
                    if grid[row][col] and grid[row][col]['count'] > 0:
                        count = grid[row][col]['count']
                        actions = grid[row][col]['actions']
                        # Normalize by count
                        for action in actions:
                            actions[action] /= count
                        grid[row][col] = actions
                    else:
                        grid[row][col] = {}

            return {
                'grid': grid,
                'actions': actions,
                'node': self.pio_node
            }

        except Exception as e:
            print(f"[GameState] Error getting villain strategy: {e}", flush=True)
            import traceback
            traceback.print_exc()
            return None

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
            # For testing: always show villain cards
            hide = False  # was: not p.is_human and self.street != 'showdown' and not self.hand_complete
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
            'villain_position': getattr(self, 'villain_position', 'BB'),
            'available_actions': validator.get_available_actions() if validator else [],
            'min_raise': self.current_bet + self.min_raise,
            'max_raise': (player.stack + player.current_bet) if player else 0,
            'current_bet': self.current_bet,
            'stats': self.get_stats(),
            'hand_complete': self.hand_complete,
            'winner': self.winner,
            'action_history': self.action_history,
            'pio_file': self.pio_file,
            'pio_node': self.pio_node,
            'villain_strategy': self._get_villain_strategy(),
            'pio_actions': self._get_pio_actions()
        }

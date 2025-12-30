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
        self.last_villain_strategy: Optional[Dict] = None  # Cache last villain strategy for display
        self.player_hand_strategies: Dict[str, Dict] = {}  # Cache hand strategy per position
        self.player_combo_frequencies: Dict[str, float] = {}  # Cache combo frequency per position
        self.strategy_history: List[Dict[str, Any]] = []  # History of villain strategies with actions

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
        self.last_villain_strategy = None  # Reset cached strategy
        self.player_hand_strategies = {}  # Reset hand strategy cache
        self.player_combo_frequencies = {}  # Reset combo frequency cache
        self.strategy_history = []  # Reset strategy history

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

        # Calculate pot before this action (for percentage display)
        # Total pot = main pot + all current bets on the table
        total_pot_before = self.pot + sum(p.current_bet for p in self.players.values())

        # Calculate call amount for recording
        call_amount = None
        pot_before_bet = None
        if action == 'call':
            call_amount = self.current_bet - player.current_bet
            call_amount = min(call_amount, player.stack)
            # For calls, pot_before_bet is the pot before the bet being called
            # This is: total_pot - the bet amount already on the table from the bettor
            pot_before_bet = total_pot_before - self.current_bet

        # Determine if this is a bet or raise for display purposes
        # Post-flop: first aggression is 'bet', subsequent is 'raise'
        # Preflop: blinds count as bets, so any increase is 'raise'
        display_action = action
        bet_being_raised = None
        if action == 'raise':
            if self.street != 'preflop' and self.current_bet == 0:
                display_action = 'bet'
            else:
                # Track the bet being raised (for multiplier display)
                bet_being_raised = self.current_bet
            # For bets/raises, pot_before_bet is the current total pot
            pot_before_bet = total_pot_before

        # Record action in history
        action_record = {
            'position': player.position,
            'action': display_action,
            'street': self.street,
            'amount': amount if action in ['raise', 'bet'] else None,
            'call_amount': call_amount,
            'current_bet': self.current_bet if action == 'raise' else None,
            'pot_before_bet': pot_before_bet,
            'bet_being_raised': bet_being_raised
        }
        self.action_history.append(action_record)

        # Tag the last strategy history entry with this action (for villain actions)
        if not player.is_human and self.strategy_history and self.strategy_history[-1]['action'] is None:
            self.strategy_history[-1]['action'] = action_record

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

    def _get_player_cumulative_invested(self, player_position: str) -> int:
        """
        Parse the node path to calculate how much the player has invested total (across all streets).

        PioSolver bet amounts are cumulative for the entire hand, not per street.
        We need to track each player's total investment from their actions in the node path.

        Args:
            player_position: 'OOP' or 'IP'

        Returns:
            Total chips invested by this player so far
        """
        if not self.pio_node:
            return 0

        parts = self.pio_node.split(':')

        # Determine which positions in the action sequence belong to which player
        # After 'r:0', actions alternate: OOP acts first postflop, then IP, etc.
        # Cards (like '6h') don't count as actions - they mark street transitions

        # Track who acts when and their investments
        oop_invested = 0
        ip_invested = 0
        is_oop_turn = True  # OOP acts first postflop

        for part in parts:
            if part in ('r', '0'):
                continue

            # Check if this is a card (2 chars, second is suit)
            if len(part) == 2 and part[1] in 'shdc':
                # Street transition - turn order resets, OOP acts first
                is_oop_turn = True
                continue

            # This is an action
            if part == 'c':
                # Call - player matches the current bet
                if is_oop_turn:
                    oop_invested = ip_invested  # Match opponent's bet
                else:
                    ip_invested = oop_invested
            elif part == 'f':
                pass  # Fold doesn't change investment
            elif part.startswith('b'):
                try:
                    bet_total = int(part[1:])
                    if is_oop_turn:
                        oop_invested = bet_total
                    else:
                        ip_invested = bet_total
                except ValueError:
                    pass

            # Alternate turns (unless it's a check/bet situation where action continues)
            is_oop_turn = not is_oop_turn

        return oop_invested if player_position == 'OOP' else ip_invested

    def _get_pio_actions(self) -> Optional[List[Dict]]:
        """
        Get available actions from PioSolver tree at current node.

        Returns:
            List of action dicts with 'type' and optionally 'amount' and 'total' for bets/raises
            e.g., [{'type': 'check'}, {'type': 'raise', 'amount': 21, 'total': 42}]
            'amount' = actual chips being added to pot, 'total' = cumulative (PioSolver format)
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

            # Determine if hero is OOP or IP based on position
            # In heads-up BTN vs BB: BTN is IP, BB is OOP
            hero_pio_position = 'IP' if player.position == 'BTN' else 'OOP'

            # Get cumulative investment for this player from the node path
            player_invested = self._get_player_cumulative_invested(hero_pio_position)

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
                    # PioSolver 'total' is cumulative for entire hand
                    # 'amount' is actual chips being added (total - already invested)
                    try:
                        total = int(pio_action[1:])
                        actual_bet = total - player_invested
                        actions.append({
                            'type': 'raise',
                            'amount': actual_bet,  # Chips being added to pot
                            'total': total         # Cumulative (for PioSolver node tracking)
                        })
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

        # If it's the hero's turn, return the cached villain strategy
        player = self.get_player_to_act()
        if not player or player.is_human:
            return self.last_villain_strategy

        try:
            # Determine which player is acting at this node
            node_info = self.pio_connection.show_node(self.pio_node)
            node_type = node_info.get('node_type', '')
            # OOP_DEC = OOP decision, IP_DEC = IP decision
            player = 'OOP' if 'OOP' in node_type else 'IP'

            # Get range weights from show_range (1326 floats, 0-1 for each hand)
            range_weights = self.pio_connection.show_range(player, self.pio_node)
            if len(range_weights) != 1326:
                return None

            # Get strategy at current node
            strategy = self.pio_connection.show_strategy(self.pio_node)
            if not strategy:
                return None

            hand_order = self.pio_connection.hand_order
            if len(hand_order) != 1326:
                return None

            # Get the actions available at this node
            raw_actions = list(strategy.keys())
            if not raw_actions:
                return None

            # Calculate player's cumulative investment for actual bet amounts
            player_invested = self._get_player_cumulative_invested(player)

            # Parse actions to include actual bet amounts
            actions = []
            for action_str in raw_actions:
                if action_str.startswith('b'):
                    try:
                        total = int(action_str[1:])
                        actual_bet = total - player_invested
                        actions.append({
                            'action': action_str,
                            'amount': actual_bet,
                            'total': total
                        })
                    except ValueError:
                        actions.append({'action': action_str, 'amount': None, 'total': None})
                else:
                    actions.append({'action': action_str, 'amount': None, 'total': None})

            # Build 13x13 strategy grid for each action
            RANKS_ORDER = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
            SUITS = ['s', 'h', 'd', 'c']

            # Build set of known cards (board + hero's hole cards) for blocker calculations
            known_cards = set()
            for card in self.community_cards:
                card_str = str(card)
                if len(card_str) >= 2:
                    known_cards.add(card_str)
            # Add hero's hole cards
            hero = self.players.get(self.human_position)
            if hero and hero.hole_cards:
                for card in hero.hole_cards:
                    card_str = str(card)
                    if len(card_str) >= 2:
                        known_cards.add(card_str)

            # Calculate max combos accounting for known card blockers
            def get_max_combos(row, col):
                rank1 = RANKS_ORDER[row]
                rank2 = RANKS_ORDER[col]

                if row == col:  # Pairs
                    # Count how many of this rank are in known cards
                    blocked_count = sum(1 for card in known_cards if card[0] == rank1)
                    available = 4 - blocked_count
                    # C(n, 2) = n * (n-1) / 2
                    if available < 2:
                        return 0
                    return available * (available - 1) // 2

                elif row < col:  # Suited (above diagonal)
                    # Count how many suited combos are blocked
                    blocked = 0
                    for suit in SUITS:
                        combo1 = f"{rank1}{suit}"
                        combo2 = f"{rank2}{suit}"
                        if combo1 in known_cards or combo2 in known_cards:
                            blocked += 1
                    return 4 - blocked

                else:  # Offsuit (below diagonal)
                    # Count non-blocked offsuit combos
                    count = 0
                    for suit1 in SUITS:
                        for suit2 in SUITS:
                            if suit1 == suit2:
                                continue  # Skip suited
                            combo1 = f"{rank1}{suit1}"
                            combo2 = f"{rank2}{suit2}"
                            if combo1 not in known_cards and combo2 not in known_cards:
                                count += 1
                    return count

            # For each cell, store range weight sum and action frequencies
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

                # Get range weight for this hand (how much of this combo is in range)
                range_weight = range_weights[i] if i < len(range_weights) else 0

                # Initialize cell if needed
                if grid[row][col] is None:
                    grid[row][col] = {'actions': {}, 'range_sum': 0}

                # Add range weight
                grid[row][col]['range_sum'] += range_weight

                # Get action frequencies for this hand (weighted by range)
                if range_weight > 0:
                    for action, freqs in strategy.items():
                        if i < len(freqs) and freqs[i] > 0:
                            if action not in grid[row][col]['actions']:
                                grid[row][col]['actions'][action] = 0
                            # Weight action frequency by range weight
                            grid[row][col]['actions'][action] += freqs[i] * range_weight

            # Normalize: divide by max possible combos to get true percentages
            for row in range(13):
                for col in range(13):
                    max_combos = get_max_combos(row, col)
                    if max_combos == 0:
                        # No combos possible (blocked by board)
                        grid[row][col] = {}
                    elif grid[row][col] and grid[row][col]['range_sum'] > 0:
                        cell = grid[row][col]
                        # Normalize by max combos to get % of hand class
                        normalized = {}
                        for action, freq_sum in cell['actions'].items():
                            normalized[action] = freq_sum / max_combos
                        grid[row][col] = normalized
                    else:
                        grid[row][col] = {}

            # Cache and return the strategy
            # Calculate total pot for percentage display
            total_pot = self.pot + sum(p.current_bet for p in self.players.values())
            self.last_villain_strategy = {
                'grid': grid,
                'actions': actions,
                'node': self.pio_node,
                'is_check': self.current_bet == 0,  # True if check, False if call
                'pot': total_pot,
                'current_bet': self.current_bet  # For bet vs raise distinction
            }

            # Save to strategy history (will be tagged with action after villain acts)
            self.strategy_history.append({
                'strategy': self.last_villain_strategy,
                'street': self.street,
                'node': self.pio_node,
                'action': None  # Will be filled in after villain acts
            })

            return self.last_villain_strategy

        except Exception as e:
            print(f"[GameState] Error getting villain strategy: {e}", flush=True)
            import traceback
            traceback.print_exc()
            return self.last_villain_strategy  # Return cached version on error

    def _get_range_composition(self) -> Optional[Dict[str, Any]]:
        """
        Calculate range composition breakdown for villain's current range.
        Uses PioSolver's hand strength categories (like Flopzilla) for postflop.
        """
        if not self.pio_connection or not self.pio_node or self.street == 'preflop':
            return None

        try:
            # Determine villain's position
            player = self.get_player_to_act()
            if not player or player.is_human:
                # Use cached composition if it's hero's turn
                return getattr(self, 'last_range_composition', None)

            node_info = self.pio_connection.show_node(self.pio_node)
            node_type = node_info.get('node_type', '')
            pio_player = 'OOP' if 'OOP' in node_type else 'IP'

            # Get range weights
            range_weights = self.pio_connection.show_range(pio_player, self.pio_node)
            if len(range_weights) != 1326:
                return None

            hand_order = self.pio_connection.hand_order
            if len(hand_order) != 1326:
                return None

            # Get PioSolver hand categories for this board
            board_str = ''.join(str(c) for c in self.community_cards)
            category_names = self.pio_connection.show_category_names()
            category_indices = self.pio_connection.show_categories(board_str)

            hand_strength_names = category_names.get('hand_strength', [])
            draw_names = category_names.get('draws', [])
            hand_strength_indices = category_indices.get('hand_strength', [])
            draw_indices = category_indices.get('draws', [])

            if len(hand_strength_indices) != 1326 or len(draw_indices) != 1326:
                print(f"[GameState] Invalid category data: hs={len(hand_strength_indices)}, draws={len(draw_indices)}", flush=True)
                return getattr(self, 'last_range_composition', None)

            # Aggregate weights by hand strength category
            hs_weights = {}
            draw_weights = {}
            total_weight = 0.0

            for i in range(1326):
                weight = range_weights[i] if i < len(range_weights) else 0
                if weight <= 0:
                    continue

                total_weight += weight

                # Hand strength category
                hs_idx = hand_strength_indices[i]
                if 0 <= hs_idx < len(hand_strength_names):
                    hs_name = hand_strength_names[hs_idx]
                    hs_weights[hs_name] = hs_weights.get(hs_name, 0.0) + weight

                # Draw category
                draw_idx = draw_indices[i]
                if 0 <= draw_idx < len(draw_names):
                    draw_name = draw_names[draw_idx]
                    draw_weights[draw_name] = draw_weights.get(draw_name, 0.0) + weight

            # Calculate percentages for hand strength
            hand_strength = {}
            if total_weight > 0:
                for name, weight in hs_weights.items():
                    if weight > 0:
                        hand_strength[name] = {
                            'percent': round((weight / total_weight) * 100, 1),
                            'combos': round(weight, 1)
                        }

            # Calculate percentages for draws
            draws = {}
            if total_weight > 0:
                for name, weight in draw_weights.items():
                    if weight > 0:
                        draws[name] = {
                            'percent': round((weight / total_weight) * 100, 1),
                            'combos': round(weight, 1)
                        }

            result = {
                'hand_strength': hand_strength,
                'draws': draws,
                'total_combos': round(total_weight, 1)
            }

            self.last_range_composition = result
            return result

        except Exception as e:
            print(f"[GameState] Error getting range composition: {e}", flush=True)
            import traceback
            traceback.print_exc()
            return getattr(self, 'last_range_composition', None)

    def _get_hand_strategy(self, hole_cards, pio_position: str) -> Optional[Dict[str, float]]:
        """
        Get strategy frequencies for a specific hand at the current node.

        Args:
            hole_cards: List of Card objects (player's hole cards)
            pio_position: 'OOP' or 'IP'

        Returns:
            Dict mapping action labels to frequencies, e.g., {'Check': 0.45, 'Bet 21': 0.55}
        """
        if not self.pio_connection or not self.pio_node or self.street == 'preflop':
            return None

        if not hole_cards or len(hole_cards) < 2:
            return None

        try:
            # Get hand string and find index
            hand = str(hole_cards[0]) + str(hole_cards[1])
            hand_idx = self.pio_connection.get_hand_index(hand)
            if hand_idx < 0:
                return None

            # Get strategy at current node
            strategy = self.pio_connection.show_strategy(self.pio_node)
            if not strategy:
                return None

            # Get children to map actions
            children = self.pio_connection.show_children(self.pio_node)
            if not children:
                return None

            # Build result with readable action labels (include all actions, even 0%)
            result = {}
            for child in children:
                action_str = child['action']
                if action_str in strategy:
                    freq = strategy[action_str][hand_idx]
                    # Convert to readable label
                    if action_str == 'f':
                        label = 'Fold'
                    elif action_str == 'c':
                        # Check if there's a bet to call or not
                        label = 'C' if self.current_bet > 0 else 'X'
                    elif action_str.startswith('b'):
                        # Calculate actual bet amount
                        pio_total = int(action_str[1:])
                        player_invested = self._get_player_cumulative_invested(pio_position)
                        actual_bet = pio_total - player_invested
                        # Determine if bet or raise based on current_bet
                        if self.current_bet > 0:
                            # It's a raise - show multiplier
                            multiplier = actual_bet / self.current_bet if self.current_bet > 0 else 0
                            mult_display = f'{multiplier:.1f}' if multiplier % 1 != 0 else f'{int(multiplier)}'
                            label = f'R{actual_bet} ({mult_display}x)'
                        else:
                            # It's a bet - show pot percentage
                            total_pot = self.pot + sum(p.current_bet for p in self.players.values())
                            pct = round((actual_bet / total_pot) * 100) if total_pot > 0 else 0
                            label = f'B{actual_bet} ({pct}%)'
                    else:
                        label = action_str
                    result[label] = round(freq * 100, 1)  # Convert to percentage

            return result if result else None

        except Exception as e:
            print(f"[GameState] Error getting hand strategy: {e}", flush=True)
            return None

    def _get_combo_frequency(self, hole_cards, pio_position: str) -> Optional[float]:
        """
        Get the frequency/weight of a specific hand combo in the range at current node.

        Args:
            hole_cards: List of Card objects (player's hole cards)
            pio_position: 'OOP' or 'IP'

        Returns:
            Float representing the combo frequency (0-1), or None if unavailable
        """
        if not self.pio_connection or not self.pio_node or self.street == 'preflop':
            return None

        if not hole_cards or len(hole_cards) < 2:
            return None

        try:
            hand = str(hole_cards[0]) + str(hole_cards[1])
            hand_idx = self.pio_connection.get_hand_index(hand)
            if hand_idx < 0:
                return None

            # Get range at current node for this position
            range_data = self.pio_connection.show_range(pio_position, self.pio_node)
            if not range_data or len(range_data) <= hand_idx:
                return None

            return round(range_data[hand_idx] * 100, 1)  # Convert to percentage

        except Exception as e:
            print(f"[GameState] Error getting combo frequency: {e}", flush=True)
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
            player_data = p.to_dict(hide_cards=hide)

            # Update hand strategy and combo frequency cache when it's this player's turn to act
            if p.is_active and p.hole_cards and not p.folded and pos == self.action_on:
                # Determine PioSolver position: BTN = IP, BB = OOP
                pio_pos = 'IP' if pos == 'BTN' else 'OOP'
                new_strategy = self._get_hand_strategy(p.hole_cards, pio_pos)
                if new_strategy:
                    self.player_hand_strategies[pos] = new_strategy
                # Cache combo frequency at decision point (for villain only)
                if not p.is_human:
                    combo_freq = self._get_combo_frequency(p.hole_cards, pio_pos)
                    if combo_freq is not None:
                        self.player_combo_frequencies[pos] = combo_freq

            # Always include cached strategy if available
            if pos in self.player_hand_strategies:
                player_data['hand_strategy'] = self.player_hand_strategies[pos]

            # Include cached combo frequency for villain
            if pos in self.player_combo_frequencies:
                player_data['combo_frequency'] = self.player_combo_frequencies[pos]

            players_dict[pos] = player_data

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
            'pio_actions': self._get_pio_actions(),
            'strategy_history': self.strategy_history,
            'range_composition': self._get_range_composition()
        }

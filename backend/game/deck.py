import random
from typing import List, Optional

RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
SUITS = ['h', 'd', 'c', 's']  # hearts, diamonds, clubs, spades

RANK_VALUES = {r: i for i, r in enumerate(RANKS)}


class Card:
    def __init__(self, rank: str, suit: str):
        if rank not in RANKS:
            raise ValueError(f"Invalid rank: {rank}")
        if suit not in SUITS:
            raise ValueError(f"Invalid suit: {suit}")
        self.rank = rank
        self.suit = suit

    def __str__(self) -> str:
        return f"{self.rank}{self.suit}"

    def __repr__(self) -> str:
        return self.__str__()

    def __eq__(self, other) -> bool:
        if not isinstance(other, Card):
            return False
        return self.rank == other.rank and self.suit == other.suit

    def __hash__(self) -> int:
        return hash((self.rank, self.suit))

    @property
    def rank_value(self) -> int:
        return RANK_VALUES[self.rank]

    def to_dict(self) -> str:
        return str(self)

    @classmethod
    def from_string(cls, s: str) -> 'Card':
        if len(s) != 2:
            raise ValueError(f"Invalid card string: {s}")
        return cls(s[0], s[1])


class Deck:
    def __init__(self):
        self.cards: List[Card] = []
        self.reset()

    def reset(self):
        self.cards = [Card(r, s) for r in RANKS for s in SUITS]
        self.shuffle()

    def shuffle(self):
        random.shuffle(self.cards)

    def deal(self, n: int = 1) -> List[Card]:
        if n > len(self.cards):
            raise ValueError(f"Cannot deal {n} cards, only {len(self.cards)} remaining")
        dealt = self.cards[:n]
        self.cards = self.cards[n:]
        return dealt

    def deal_one(self) -> Card:
        return self.deal(1)[0]

    def remaining(self) -> int:
        return len(self.cards)

    def remove_cards(self, cards: List[Card]):
        for card in cards:
            if card in self.cards:
                self.cards.remove(card)

from typing import List, Tuple
from collections import Counter
from .deck import Card, RANK_VALUES


class HandRank:
    HIGH_CARD = 0
    PAIR = 1
    TWO_PAIR = 2
    THREE_OF_A_KIND = 3
    STRAIGHT = 4
    FLUSH = 5
    FULL_HOUSE = 6
    FOUR_OF_A_KIND = 7
    STRAIGHT_FLUSH = 8
    ROYAL_FLUSH = 9


class HandEvaluator:
    def evaluate(self, cards: List[Card]) -> Tuple[int, List[int]]:
        if len(cards) < 5:
            raise ValueError("Need at least 5 cards to evaluate")

        best_rank = (HandRank.HIGH_CARD, [0])

        from itertools import combinations
        for combo in combinations(cards, 5):
            rank = self._evaluate_five(list(combo))
            if rank > best_rank:
                best_rank = rank

        return best_rank

    def _evaluate_five(self, cards: List[Card]) -> Tuple[int, List[int]]:
        ranks = sorted([c.rank_value for c in cards], reverse=True)
        suits = [c.suit for c in cards]

        is_flush = len(set(suits)) == 1
        is_straight, straight_high = self._check_straight(ranks)

        rank_counts = Counter(ranks)
        counts = sorted(rank_counts.values(), reverse=True)

        if is_straight and is_flush:
            if straight_high == 12:
                return (HandRank.ROYAL_FLUSH, [straight_high])
            return (HandRank.STRAIGHT_FLUSH, [straight_high])

        if counts == [4, 1]:
            quad_rank = [r for r, c in rank_counts.items() if c == 4][0]
            kicker = [r for r, c in rank_counts.items() if c == 1][0]
            return (HandRank.FOUR_OF_A_KIND, [quad_rank, kicker])

        if counts == [3, 2]:
            trip_rank = [r for r, c in rank_counts.items() if c == 3][0]
            pair_rank = [r for r, c in rank_counts.items() if c == 2][0]
            return (HandRank.FULL_HOUSE, [trip_rank, pair_rank])

        if is_flush:
            return (HandRank.FLUSH, ranks)

        if is_straight:
            return (HandRank.STRAIGHT, [straight_high])

        if counts == [3, 1, 1]:
            trip_rank = [r for r, c in rank_counts.items() if c == 3][0]
            kickers = sorted([r for r, c in rank_counts.items() if c == 1], reverse=True)
            return (HandRank.THREE_OF_A_KIND, [trip_rank] + kickers)

        if counts == [2, 2, 1]:
            pairs = sorted([r for r, c in rank_counts.items() if c == 2], reverse=True)
            kicker = [r for r, c in rank_counts.items() if c == 1][0]
            return (HandRank.TWO_PAIR, pairs + [kicker])

        if counts == [2, 1, 1, 1]:
            pair_rank = [r for r, c in rank_counts.items() if c == 2][0]
            kickers = sorted([r for r, c in rank_counts.items() if c == 1], reverse=True)
            return (HandRank.PAIR, [pair_rank] + kickers)

        return (HandRank.HIGH_CARD, ranks)

    def _check_straight(self, ranks: List[int]) -> Tuple[bool, int]:
        unique = sorted(set(ranks), reverse=True)

        if len(unique) < 5:
            return False, 0

        for i in range(len(unique) - 4):
            if unique[i] - unique[i + 4] == 4:
                return True, unique[i]

        if set([12, 3, 2, 1, 0]).issubset(set(unique)):
            return True, 3

        return False, 0

    def get_hand_name(self, hand_rank: Tuple[int, List[int]]) -> str:
        names = {
            HandRank.HIGH_CARD: "High Card",
            HandRank.PAIR: "Pair",
            HandRank.TWO_PAIR: "Two Pair",
            HandRank.THREE_OF_A_KIND: "Three of a Kind",
            HandRank.STRAIGHT: "Straight",
            HandRank.FLUSH: "Flush",
            HandRank.FULL_HOUSE: "Full House",
            HandRank.FOUR_OF_A_KIND: "Four of a Kind",
            HandRank.STRAIGHT_FLUSH: "Straight Flush",
            HandRank.ROYAL_FLUSH: "Royal Flush"
        }
        return names.get(hand_rank[0], "Unknown")

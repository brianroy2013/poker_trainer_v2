"""
PioSolver Integration for Poker Trainer

Communicates with PioSolver via UPI to extract ranges and hand frequencies.
"""

import subprocess
import os
from typing import List, Dict, Optional, Tuple


class PioSolverConnection:
    """Wrapper for PioSolver UPI communication."""

    def __init__(self, pio_path: str = r"C:\PioSOLVER\PioSOLVER2-pro.exe"):
        self.pio_path = pio_path
        self.process: Optional[subprocess.Popen] = None
        self.hand_order: List[str] = []  # Will be populated from PioSolver
        self._start()

    def _start(self):
        """Start the PioSolver subprocess."""
        pio_dir = os.path.dirname(self.pio_path)

        self.process = subprocess.Popen(
            [self.pio_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=pio_dir
        )

        # Read startup banner (4 lines)
        for _ in range(4):
            line = self.process.stdout.readline()
            if not line:
                raise RuntimeError("PioSolver process ended unexpectedly")

        # Configure end string marker
        self._send_raw(b"set_end_string END\n")
        self._read_until_end()

        # Verify solver is ready
        self._send_raw(b"is_ready\n")
        response = self._read_until_end()
        if not any(b"ok" in line.lower() for line in response):
            raise RuntimeError("PioSolver did not respond to is_ready")

        # Get the hand order from PioSolver
        self._fetch_hand_order()

    def _fetch_hand_order(self):
        """Fetch the 1326 hand order from PioSolver."""
        response = self._send_command("show_hand_order")
        # Response is space-separated hands like "2d2c 2h2c 2h2d ..."
        all_hands = []
        for line in response:
            hands = line.strip().split()
            all_hands.extend(hands)
        self.hand_order = all_hands

    def _send_raw(self, data: bytes):
        """Send raw bytes to the process."""
        if self.process and self.process.stdin:
            self.process.stdin.write(data)
            self.process.stdin.flush()

    def _read_until_end(self) -> List[bytes]:
        """Read stdout lines until 'END' marker."""
        lines = []
        while True:
            line = self.process.stdout.readline()
            if not line:
                break
            line = line.rstrip(b'\n\r')
            if line == b"END":
                break
            lines.append(line)
        return lines

    def _send_command(self, command: str) -> List[str]:
        """Send a command and return response lines as strings."""
        if not self.process:
            raise RuntimeError("PioSolver process not running")

        self._send_raw((command + "\n").encode('utf-8'))
        raw_lines = self._read_until_end()
        return [line.decode('utf-8', errors='replace') for line in raw_lines]

    def load_tree(self, cfr_path: str) -> bool:
        """Load a .cfr tree file."""
        response = self._send_command(f"load_tree {cfr_path}")
        return any("ok" in line.lower() for line in response)

    def show_node(self, node_id: str = "r") -> Dict:
        """Get node information."""
        response = self._send_command(f"show_node {node_id}")

        result = {}
        if len(response) >= 1:
            result['node_id'] = response[0].strip()
        if len(response) >= 2:
            result['node_type'] = response[1].strip()
        if len(response) >= 3:
            result['board'] = response[2].strip()
        if len(response) >= 4:
            try:
                pot_values = [int(x) for x in response[3].split()]
                result['pot'] = pot_values[-1] if pot_values else 0
            except ValueError:
                result['pot'] = response[3]

        return result

    def show_range(self, player: str, node_id: str = "r") -> List[float]:
        """
        Get player range at a node.

        Args:
            player: 'OOP' or 'IP'
            node_id: Node identifier (default 'r' for root/flop)

        Returns:
            List of 1326 floats representing hand weights
        """
        response = self._send_command(f"show_range {player} {node_id}")

        all_values = []
        for line in response:
            values = line.strip().split()
            all_values.extend([float(v) for v in values])

        return all_values

    def show_children(self, node_id: str = "r:0") -> List[Dict]:
        """
        Get all child nodes of a given node.

        Args:
            node_id: Node identifier (e.g., 'r:0' for root)

        Returns:
            List of dicts with 'action' (e.g., 'c', 'b75', 'f') and 'node_id' (full path)
        """
        response = self._send_command(f"show_children {node_id}")

        children = []
        # Response contains detailed info for each child
        # Child node IDs are lines that start with the parent node_id followed by ":"
        # e.g., for parent 'r:0', children are 'r:0:c', 'r:0:b75', etc.
        prefix = node_id + ":"
        for line in response:
            line = line.strip()
            if line.startswith(prefix):
                # This is a child node ID - extract the action
                action = line[len(prefix):]
                # Skip if action contains spaces (not a valid action)
                if ' ' not in action and action:
                    children.append({
                        'action': action,
                        'node_id': line
                    })

        print(f"[PioSolver] show_children({node_id}) -> {children}", flush=True)
        return children

    def show_strategy(self, node_id: str) -> Dict[str, List[float]]:
        """
        Get strategy frequencies for all actions at a decision node.

        Args:
            node_id: Node identifier

        Returns:
            Dict mapping action string -> list of 1326 frequencies
        """
        # First get children to know what actions are available
        children = self.show_children(node_id)
        if not children:
            return {}

        response = self._send_command(f"show_strategy {node_id}")

        # Response format: each line contains 1326 frequencies for one action
        # Actions are in the same order as children
        strategy = {}
        for i, line in enumerate(response):
            if i < len(children):
                action = children[i]['action']
                values = line.strip().split()
                try:
                    frequencies = [float(v) for v in values]
                    if len(frequencies) == 1326:
                        strategy[action] = frequencies
                except ValueError:
                    continue

        return strategy

    def get_hand_index(self, hand: str) -> int:
        """
        Get the index in 1326-hand array for the given hand.

        Args:
            hand: Hand string like 'AsKd' or 'KdAs'

        Returns:
            Index in hand_order, or -1 if not found
        """
        if hand in self.hand_order:
            return self.hand_order.index(hand)
        # Try reversed card order
        reversed_hand = hand[2:4] + hand[0:2]
        if reversed_hand in self.hand_order:
            return self.hand_order.index(reversed_hand)
        return -1

    def get_hands_with_frequencies(self, player: str, node_id: str = "r", board_cards: List[str] = None) -> List[Tuple[str, float]]:
        """
        Get all hands with their frequencies for a player.

        Args:
            player: 'OOP' or 'IP'
            node_id: Node identifier
            board_cards: List of board cards to filter out (e.g., ['Ts', '7h', '2s'])

        Returns:
            List of (hand_name, frequency) tuples, sorted by frequency descending
        """
        weights = self.show_range(player, node_id)

        if len(weights) != 1326:
            raise ValueError(f"Expected 1326 weights, got {len(weights)}")

        if len(self.hand_order) != 1326:
            raise ValueError(f"Expected 1326 hands in order, got {len(self.hand_order)}")

        hands_with_freq = []
        for i, weight in enumerate(weights):
            if weight > 0:  # Only include hands with non-zero frequency
                hand_name = self.hand_order[i]
                # Filter out hands containing board cards
                if board_cards:
                    blocked = False
                    for bc in board_cards:
                        if bc in hand_name:
                            blocked = True
                            break
                    if blocked:
                        continue
                hands_with_freq.append((hand_name, weight))

        # Sort by frequency descending
        hands_with_freq.sort(key=lambda x: x[1], reverse=True)

        return hands_with_freq

    def close(self):
        """Close the PioSolver process."""
        if self.process:
            try:
                self._send_raw(b"exit\n")
                self.process.wait(timeout=5)
            except:
                self.process.kill()
            self.process = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def extract_hands_to_file(cfr_path: str, output_path: str, player: str = "OOP") -> bool:
    """
    Extract hands and frequencies from a .cfr file and save to a text file.

    Args:
        cfr_path: Path to the .cfr file
        output_path: Path to save the output file
        player: 'OOP' or 'IP'

    Returns:
        True if successful, False otherwise
    """
    try:
        with PioSolverConnection() as solver:
            if not solver.load_tree(cfr_path):
                print(f"Failed to load tree: {cfr_path}")
                return False

            # Get node info for board
            node_info = solver.show_node("r")
            board = node_info.get('board', 'Unknown')
            board_cards = board.split()

            # Get hands with frequencies (filtering out blocked hands)
            hands = solver.get_hands_with_frequencies(player, "r", board_cards=board_cards)

            # Write to file
            with open(output_path, 'w') as f:
                f.write(f"# {player} Hands from: {cfr_path}\n")
                f.write(f"# Board: {board}\n")
                f.write(f"# Total hands: {len(hands)}\n")
                f.write("#\n")
                f.write("# Hand, Frequency\n")
                for hand, freq in hands:
                    f.write(f"{hand},{freq:.6f}\n")
            return True

    except Exception as e:
        print(f"Error extracting {player} hands: {e}")
        import traceback
        traceback.print_exc()
        return False


def extract_oop_hands_to_file(cfr_path: str, output_path: str) -> bool:
    """Extract OOP hands - wrapper for backwards compatibility."""
    return extract_hands_to_file(cfr_path, output_path, "OOP")


def extract_ip_hands_to_file(cfr_path: str, output_path: str) -> bool:
    """Extract IP hands."""
    return extract_hands_to_file(cfr_path, output_path, "IP")

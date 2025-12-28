"""
PioSolver Range Extractor - CLI Tool

Extracts player ranges from a PioSolver .cfr file at the flop node.
Communicates with PioSolver via UPI (Universal Poker Interface).

Usage:
    python pio_reader.py <path_to_cfr_file>

Example:
    python pio_reader.py "C:\\PioSOLVER\\saves\\HH_J92_base_solve.cfr"
"""

import subprocess
import sys
import os
from typing import List, Dict, Optional


class PioSolver:
    """Wrapper for PioSolver UPI communication."""

    def __init__(self, pio_path: str = r"C:\PioSOLVER\PioSOLVER2-pro.exe"):
        self.pio_path = pio_path
        self.process: Optional[subprocess.Popen] = None
        self._start()

    def _start(self):
        """Start the PioSolver subprocess."""
        # Get the directory containing PioSolver
        pio_dir = os.path.dirname(self.pio_path)

        self.process = subprocess.Popen(
            [self.pio_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # Merge stderr into stdout
            cwd=pio_dir  # Run from PioSolver's directory
        )

        # Read startup banner (version, registration info)
        # PioSolver outputs: version line, copyright line, registration line, blank line
        for _ in range(4):
            line = self.process.stdout.readline()
            if not line:
                raise RuntimeError("PioSolver process ended unexpectedly")

        # Configure end string marker for easier parsing
        self._send_raw(b"set_end_string END\n")
        self._read_until_end()

        # Verify solver is ready
        self._send_raw(b"is_ready\n")
        response = self._read_until_end()
        if not any(b"ok" in line.lower() for line in response):
            raise RuntimeError("PioSolver did not respond to is_ready")

    def _send_raw(self, data: bytes):
        """Send raw bytes to the process."""
        if self.process and self.process.stdin:
            self.process.stdin.write(data)
            self.process.stdin.flush()

    def _read_lines(self, count: int) -> List[bytes]:
        """Read a specific number of lines."""
        lines = []
        for _ in range(count):
            line = self.process.stdout.readline()
            if line:
                lines.append(line.rstrip(b'\n\r'))
        return lines

    def _send_command(self, command: str) -> List[str]:
        """Send a command and return response lines as strings."""
        if not self.process:
            raise RuntimeError("PioSolver process not running")

        self._send_raw((command + "\n").encode('utf-8'))
        raw_lines = self._read_until_end()
        return [line.decode('utf-8', errors='replace') for line in raw_lines]

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

    def load_tree(self, cfr_path: str) -> bool:
        """Load a .cfr tree file."""
        response = self._send_command(f"load_tree {cfr_path}")
        return any("ok" in line.lower() for line in response)

    def show_node(self, node_id: str = "r") -> Dict:
        """
        Get node information.

        Response format (from UPI docs):
        - Line 1: nodeID
        - Line 2: node_type (OOP_DEC, IP_DEC, ROOT, etc.)
        - Line 3: board (e.g., "Jh 9d 2s")
        - Line 4: pot (e.g., "0 0 42" = OOP_invested IP_invested pot_size)
        - Line 5: children count (e.g., "1 children")
        - Line 6: flags (e.g., "flags: INCOMPLETE_TREE ISOMORPHISM_ON")
        """
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
                result['pot'] = pot_values[-1] if pot_values else 0  # Last value is pot size
            except ValueError:
                result['pot'] = response[3]
        if len(response) >= 5:
            # Extract just the number from "1 children"
            children_str = response[4].strip()
            try:
                result['children_no'] = int(children_str.split()[0])
            except (ValueError, IndexError):
                result['children_no'] = children_str
        if len(response) >= 6:
            # Remove "flags:" prefix
            flags_str = response[5].replace('flags:', '').strip()
            result['flags'] = flags_str.split() if flags_str else []

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

        # Response is 1326 space-separated floats (may span multiple lines)
        all_values = []
        for line in response:
            values = line.strip().split()
            all_values.extend([float(v) for v in values])

        return all_values

    def close(self):
        """Close the PioSolver process."""
        if self.process:
            try:
                self.process.stdin.write("exit\n")
                self.process.stdin.flush()
                self.process.wait(timeout=5)
            except:
                self.process.kill()
            self.process = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def main():
    if len(sys.argv) < 2:
        print("Usage: python pio_reader.py <path_to_cfr_file>")
        print("Example: python pio_reader.py C:\\PioSOLVER\\saves\\HH_J92_base_solve.cfr")
        sys.exit(1)

    cfr_path = sys.argv[1]

    print(f"Loading PioSolver...")

    with PioSolver() as solver:
        # Load the tree
        print(f"Loading tree: {cfr_path}")
        if not solver.load_tree(cfr_path):
            print("Failed to load tree!")
            sys.exit(1)

        # Get node info
        node_info = solver.show_node("r")

        print(f"\nBoard: {node_info.get('board', 'Unknown')}")
        print(f"Pot: {node_info.get('pot', 'Unknown')}")
        print(f"Node type: {node_info.get('node_type', 'Unknown')}")

        # Get OOP range
        print("\n" + "="*50)
        print("OOP Range (1326 floats):")
        print("="*50)
        oop_range = solver.show_range("OOP", "r")
        print(f"Length: {len(oop_range)}")
        print(" ".join(f"{v:.4f}" for v in oop_range[:20]), "...")

        # Get IP range
        print("\n" + "="*50)
        print("IP Range (1326 floats):")
        print("="*50)
        ip_range = solver.show_range("IP", "r")
        print(f"Length: {len(ip_range)}")
        print(" ".join(f"{v:.4f}" for v in ip_range[:20]), "...")

        print("\nDone!")


if __name__ == "__main__":
    main()

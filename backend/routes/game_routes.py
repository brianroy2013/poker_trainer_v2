from flask import Blueprint, request, jsonify
from game.game_state import GameState
from game.pio_solver import PioSolverConnection
from players.computer_player import ComputerPlayer

game_bp = Blueprint('game', __name__)

# Singleton PioSolver connection
pio_connection = None
game_state = GameState()
computer_player = ComputerPlayer()


def get_pio_connection():
    """Get or create the singleton PioSolver connection."""
    global pio_connection
    if pio_connection is None:
        try:
            pio_connection = PioSolverConnection()
            print("[Routes] PioSolver connection established", flush=True)
        except Exception as e:
            print(f"[Routes] Failed to create PioSolver connection: {e}", flush=True)
            return None
    return pio_connection


@game_bp.route('/new', methods=['POST'])
def new_game():
    data = request.get_json() or {}
    hero_position = data.get('hero_position', data.get('human_position', 'BTN'))
    villain_position = data.get('villain_position', 'BB')

    valid_positions = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB']
    if hero_position not in valid_positions:
        return jsonify({'error': f'Invalid hero position. Must be one of {valid_positions}'}), 400
    if villain_position not in valid_positions:
        return jsonify({'error': f'Invalid villain position. Must be one of {valid_positions}'}), 400
    if hero_position == villain_position:
        return jsonify({'error': 'Hero and villain must be in different positions'}), 400

    # Set up PioSolver connection
    pio = get_pio_connection()
    game_state.pio_connection = pio
    computer_player.set_pio_connection(pio)

    game_state.start_new_hand(hero_position, villain_position)

    # Load the tree file if we have a connection
    if pio and game_state.pio_file:
        pio.load_tree(game_state.pio_file)

    # Don't auto-process computer actions - let frontend animate them
    return jsonify(game_state.to_dict())


@game_bp.route('/computer-action', methods=['POST'])
def computer_action():
    """Process a single computer player action. Frontend calls this repeatedly with delays."""
    if game_state.hand_complete:
        return jsonify({**game_state.to_dict(), 'action_taken': None})

    player = game_state.get_player_to_act()
    if not player:
        return jsonify({**game_state.to_dict(), 'action_taken': None})

    if player.is_human:
        return jsonify({**game_state.to_dict(), 'action_taken': None})

    # Get and execute computer action
    action_data = computer_player.get_action(game_state)
    if not action_data['action']:
        return jsonify({**game_state.to_dict(), 'action_taken': None})

    result = game_state.process_action(action_data['action'], action_data['amount'])

    return jsonify({
        **game_state.to_dict(),
        'action_taken': {
            'position': player.position,
            'action': action_data['action'],
            'amount': action_data['amount']
        }
    })


@game_bp.route('/state', methods=['GET'])
def get_state():
    return jsonify(game_state.to_dict())


@game_bp.route('/action', methods=['POST'])
def submit_action():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    action = data.get('action')
    amount = data.get('amount', 0)

    if not action:
        return jsonify({'error': 'No action provided'}), 400

    player = game_state.get_player_to_act()
    if not player:
        return jsonify({'error': 'No player to act'}), 400

    if not player.is_human:
        return jsonify({'error': 'Not human player turn'}), 400

    result = game_state.process_action(action, amount)

    if not result['success']:
        return jsonify({'error': result['error']}), 400

    # Don't auto-process computer actions - let frontend animate them
    return jsonify(game_state.to_dict())


@game_bp.route('/reset', methods=['POST'])
def reset_game():
    data = request.get_json() or {}
    hero_position = data.get('hero_position', data.get('human_position', game_state.human_position or 'BTN'))
    villain_position = data.get('villain_position', getattr(game_state, 'villain_position', 'BB'))

    game_state.start_new_hand(hero_position, villain_position)

    # Don't auto-process computer actions - let frontend animate them
    return jsonify(game_state.to_dict())

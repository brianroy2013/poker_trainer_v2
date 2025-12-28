from flask import Blueprint, request, jsonify
from game.game_state import GameState
from players.computer_player import ComputerPlayer

game_bp = Blueprint('game', __name__)

game_state = GameState()
computer_player = ComputerPlayer()


@game_bp.route('/new', methods=['POST'])
def new_game():
    data = request.get_json() or {}
    human_position = data.get('human_position', 'BTN')

    if human_position not in ['BTN', 'BB']:
        return jsonify({'error': 'Invalid position. Must be BTN or BB'}), 400

    game_state.start_new_hand(human_position)

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
    human_position = data.get('human_position', game_state.human_position or 'BTN')

    game_state.start_new_hand(human_position)

    # Don't auto-process computer actions - let frontend animate them
    return jsonify(game_state.to_dict())

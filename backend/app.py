from flask import Flask
from flask_cors import CORS
from routes.game_routes import game_bp

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.register_blueprint(game_bp, url_prefix='/api/game')

@app.route('/health')
def health():
    return {'status': 'ok'}

if __name__ == '__main__':
    app.run(debug=True, port=5001)

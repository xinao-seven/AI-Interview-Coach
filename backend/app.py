"""
AI Interview Coach — Flask Backend
===================================
Entry point. Run with: python app.py
"""

from flask import Flask
from flask_cors import CORS
from config import Config
from routes import register_routes


def create_app() -> Flask:
    app = Flask(__name__)

    # CORS for frontend dev server
    CORS(app, origins=Config.CORS_ORIGINS, supports_credentials=True)

    # Register API blueprints
    register_routes(app)

    # Health check
    @app.route("/api/health")
    def health():
        return {"status": "ok", "model": Config.AI_MODEL}

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(
        host="0.0.0.0",
        port=Config.FLASK_PORT,
        debug=Config.FLASK_DEBUG,
    )

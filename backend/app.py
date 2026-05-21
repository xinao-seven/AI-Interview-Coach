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

    CORS(app, resources={
        r"/api/*": {
            "origins": Config.CORS_ORIGINS.split(",") if Config.CORS_ORIGINS != "*" else "*",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": False,
        }
    })

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

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Application configuration, all values from environment variables."""

    # AI Provider
    AI_API_KEY = os.getenv("AI_API_KEY", "")
    AI_API_BASE = os.getenv("AI_API_BASE", "https://api.openai.com/v1")
    AI_MODEL = os.getenv("AI_MODEL", "gpt-4o")

    # Server
    FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))
    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"

    # CORS
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

    # Rate limiting (simple)
    MAX_REQUEST_TOKENS = int(os.getenv("MAX_REQUEST_TOKENS", 4096))
    TEMPERATURE = float(os.getenv("AI_TEMPERATURE", 0.7))

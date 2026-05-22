import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """应用配置类，所有配置值均从环境变量中读取。"""

    # AI 服务商配置
    AI_API_KEY = os.getenv("AI_API_KEY", "")
    AI_API_BASE = os.getenv("AI_API_BASE", "https://api.openai.com/v1")
    AI_MODEL = os.getenv("AI_MODEL", "gpt-4o")

    # 服务器配置
    FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))
    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"

    # CORS 跨域配置
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

    # 请求限制（简单实现）
    MAX_REQUEST_TOKENS = int(os.getenv("MAX_REQUEST_TOKENS", 4096))
    TEMPERATURE = float(os.getenv("AI_TEMPERATURE", 0.7))

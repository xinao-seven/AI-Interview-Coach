"""
AI 面试教练 — Flask 后端
========================
入口文件。运行方式：python app.py
"""

from flask import Flask
from flask_cors import CORS
from config import Config
from routes import register_routes


def create_app() -> Flask:
    """创建并配置 Flask 应用实例"""
    app = Flask(__name__)

    # 配置 CORS 跨域访问
    CORS(app, resources={
        r"/api/*": {
            "origins": Config.CORS_ORIGINS.split(",") if Config.CORS_ORIGINS != "*" else "*",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": False,
        }
    })

    # 注册 API 路由蓝图
    register_routes(app)

    # 健康检查接口
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

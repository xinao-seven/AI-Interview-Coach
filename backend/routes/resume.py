"""POST /api/resume/parse — AI 驱动的简历解析接口"""

from flask import Blueprint, request, jsonify
from services.ai_service import chat_completion_json
from prompts import RESUME_PARSE_SYSTEM

resume_bp = Blueprint("resume", __name__)


@resume_bp.route("/parse", methods=["POST"])
def parse_resume():
    """
    解析简历文本为结构化数据

    请求格式：{ "rawText": "..." }
    响应格式：{ "resumeInfo": {...} }
    """
    data = request.get_json(silent=True) or {}
    raw_text = data.get("rawText", "").strip()

    if not raw_text:
        return jsonify({"error": "rawText is required"}), 400

    if len(raw_text) > 15000:
        return jsonify({"error": "rawText too long (max 15000 chars)"}), 413

    try:
        resume_info = chat_completion_json(
            system_prompt=RESUME_PARSE_SYSTEM,
            user_message=f"请解析以下简历文本：\n\n{raw_text}",
        )
        return jsonify({"resumeInfo": resume_info})
    except ValueError as e:
        return jsonify({"error": "AI response parse failed", "detail": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "AI service error", "detail": str(e)}), 500

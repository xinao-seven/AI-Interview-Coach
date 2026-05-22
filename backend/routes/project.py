"""
POST /api/project/polish    — 润色项目描述
POST /api/project/questions — 生成项目深挖问题
"""

from flask import Blueprint, request, jsonify
from services.ai_service import chat_completion_json
from prompts import PROJECT_POLISH_SYSTEM, PROJECT_QUESTIONS_SYSTEM

project_bp = Blueprint("project", __name__)


@project_bp.route("/polish", methods=["POST"])
def polish_project():
    """
    润色项目描述

    请求格式：{ "project": {...} }
    响应格式：{ "optimizedProject": {...}, "suggestions": [...] }
    """
    data = request.get_json(silent=True) or {}
    project = data.get("project")

    if not project:
        return jsonify({"error": "project is required"}), 400

    try:
        result = chat_completion_json(
            system_prompt=PROJECT_POLISH_SYSTEM,
            user_message=(
                f"请优化以下项目描述：\n\n"
                f"项目名称：{project.get('name')}\n"
                f"担任角色：{project.get('role')}\n"
                f"技术栈：{', '.join(project.get('techStack', []))}\n"
                f"项目描述：{project.get('description')}\n"
                f"技术亮点：{chr(10).join(project.get('highlights', []))}\n"
                f"技术难点：{project.get('difficulties')}\n"
                f"项目成果：{project.get('result')}\n"
            ),
        )
        return jsonify({
            "optimizedProject": result.get("optimized"),
            "suggestions": result.get("suggestions", []),
        })
    except ValueError as e:
        return jsonify({"error": "AI response parse failed", "detail": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "AI service error", "detail": str(e)}), 500


@project_bp.route("/questions", methods=["POST"])
def generate_project_questions():
    """
    生成项目深挖问题

    请求格式：{ "project": {...}, "targetRole": "..." }
    响应格式：{ "questions": [...] }
    """
    data = request.get_json(silent=True) or {}
    project = data.get("project")
    target_role = data.get("targetRole", "前端开发工程师")

    if not project:
        return jsonify({"error": "project is required"}), 400

    try:
        result = chat_completion_json(
            system_prompt=PROJECT_QUESTIONS_SYSTEM,
            user_message=(
                f"目标岗位：{target_role}\n\n"
                f"请针对以下项目生成面试追问：\n\n"
                f"项目名称：{project.get('name')}\n"
                f"担任角色：{project.get('role')}\n"
                f"技术栈：{', '.join(project.get('techStack', []))}\n"
                f"项目描述：{project.get('description')}\n"
                f"技术亮点：{chr(10).join(project.get('highlights', []))}\n"
                f"技术难点：{project.get('difficulties')}\n"
            ),
        )
        return jsonify({"questions": result.get("questions", [])})
    except ValueError as e:
        return jsonify({"error": "AI response parse failed", "detail": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "AI service error", "detail": str(e)}), 500

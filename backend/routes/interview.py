"""
POST /api/interview/questions — generate interview questions
POST /api/interview/evaluate  — evaluate an answer
POST /api/interview/report    — generate interview report
"""

from flask import Blueprint, request, jsonify
from services.ai_service import chat_completion_json
from prompts import (
    INTERVIEW_QUESTIONS_SYSTEM,
    ANSWER_EVALUATION_SYSTEM,
    INTERVIEW_REPORT_SYSTEM,
)

interview_bp = Blueprint("interview", __name__)


@interview_bp.route("/questions", methods=["POST"])
def generate_questions():
    """
    Request:  { "resumeInfo": {...}, "config": {...} }
    Response: { "questions": [...] }
    """
    data = request.get_json(silent=True) or {}
    resume_info = data.get("resumeInfo")
    config = data.get("config")

    if not config:
        return jsonify({"error": "config is required"}), 400

    try:
        result = chat_completion_json(
            system_prompt=INTERVIEW_QUESTIONS_SYSTEM,
            user_message=(
                f"候选人简历信息：\n{resume_info}\n\n"
                f"面试配置：\n"
                f"- 目标岗位：{config.get('targetRole')}\n"
                f"- 面试模式：{config.get('interviewMode')}\n"
                f"- 难度：{config.get('difficulty')}\n"
                f"- 题目数量：{config.get('questionCount')}\n"
                f"- 考察方向：{', '.join(config.get('focusAreas', []))}\n"
                f"\n请生成面试题目。"
            ),
        )
        return jsonify({"questions": result.get("questions", [])})
    except ValueError as e:
        return jsonify({"error": "AI response parse failed", "detail": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "AI service error", "detail": str(e)}), 500


@interview_bp.route("/evaluate", methods=["POST"])
def evaluate_answer():
    """
    Request:  { "question": {...}, "userAnswer": "...", "resumeInfo": {...} }
    Response: { "evaluation": {...} }
    """
    data = request.get_json(silent=True) or {}
    question = data.get("question")
    user_answer = data.get("userAnswer", "")
    resume_info = data.get("resumeInfo")

    if not question:
        return jsonify({"error": "question is required"}), 400
    if not user_answer.strip():
        # Empty answer → auto zero score
        return jsonify({
            "evaluation": {
                "questionId": question.get("id"),
                "totalScore": 0,
                "accuracy": 0,
                "completeness": 0,
                "expression": 0,
                "projectRelevance": 0,
                "depth": 0,
                "strengths": [],
                "weaknesses": ["未作答"],
                "improvedAnswer": question.get("referenceAnswer", ""),
                "followUpQuestion": "",
            }
        })

    try:
        evaluation = chat_completion_json(
            system_prompt=ANSWER_EVALUATION_SYSTEM,
            user_message=(
                f"面试题目：{question.get('question')}\n"
                f"题目类型：{question.get('type')}\n"
                f"题目标签：{', '.join(question.get('tags', []))}\n"
                f"参考答案：{question.get('referenceAnswer')}\n\n"
                f"候选人简历：{resume_info}\n\n"
                f"候选人回答：\n{user_answer}\n\n"
                f"请根据以上信息进行评分。"
            ),
        )
        return jsonify({"evaluation": evaluation})
    except ValueError as e:
        return jsonify({"error": "AI response parse failed", "detail": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "AI service error", "detail": str(e)}), 500


@interview_bp.route("/report", methods=["POST"])
def generate_report():
    """
    Request:  { "session": {...} }
    Response: { "report": {...} }
    """
    data = request.get_json(silent=True) or {}
    session = data.get("session")

    if not session:
        return jsonify({"error": "session is required"}), 400

    try:
        report = chat_completion_json(
            system_prompt=INTERVIEW_REPORT_SYSTEM,
            user_message=(
                f"面试会话数据：\n{data}\n\n"
                f"请生成面试评估报告。"
            ),
        )
        return jsonify({"report": report})
    except ValueError as e:
        return jsonify({"error": "AI response parse failed", "detail": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "AI service error", "detail": str(e)}), 500

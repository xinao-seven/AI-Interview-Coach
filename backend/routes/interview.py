"""
POST /api/interview/questions       — 生成面试题目
POST /api/interview/evaluate        — 评估回答（非流式，一次性返回）
POST /api/interview/evaluate/stream — 评估回答（SSE 流式，边生成边推送）
POST /api/interview/report          — 生成面试报告
"""

import json
from flask import Blueprint, request, jsonify, Response, stream_with_context
from services.ai_service import chat_completion_json, chat_completion_stream, _extract_json
from prompts import (
    INTERVIEW_QUESTIONS_SYSTEM,
    ANSWER_EVALUATION_SYSTEM,
    INTERVIEW_REPORT_SYSTEM,
)

interview_bp = Blueprint("interview", __name__)


@interview_bp.route("/questions", methods=["POST"])
def generate_questions():
    """
    生成面试题目

    请求格式：{ "resumeInfo": {...}, "config": {...} }
    响应格式：{ "questions": [...] }
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
    评估回答

    请求格式：
        { "question": {...}, "userAnswer": "...", "resumeInfo": {...},
          "followUpContext": { "isFollowUp": bool, "followUpQuestion": "...", "mainAnswer": "..." } | null }

    响应格式：{ "evaluation": {...} }
    """
    data = request.get_json(silent=True) or {}
    question = data.get("question")
    user_answer = data.get("userAnswer", "")
    resume_info = data.get("resumeInfo")
    follow_up_context = data.get("followUpContext")  # 可选，追问评估时使用

    if not question:
        return jsonify({"error": "question is required"}), 400
    if not user_answer.strip():
        # 空回答 → 自动零分
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
        # 构建用户消息：追问场景下包含追问上下文
        if follow_up_context and follow_up_context.get("isFollowUp"):
            user_message = (
                f"【追问环节】候选人已回答了主问题，现在正在回答针对其回答的追问。\n\n"
                f"原始面试题目：{question.get('question')}\n"
                f"题目类型：{question.get('type')}\n"
                f"题目标签：{', '.join(question.get('tags', []))}\n"
                f"参考答案：{question.get('referenceAnswer')}\n\n"
                f"候选人主问题回答：\n{follow_up_context.get('mainAnswer', '')}\n\n"
                f"面试官追问：{follow_up_context.get('followUpQuestion', '')}\n\n"
                f"候选人对追问的回答：\n{user_answer}\n\n"
                f"候选人简历：{resume_info}\n\n"
                f"请针对追问的回答进行评分，重点关注候选人面对追问时的应变能力和知识深度。"
            )
        else:
            user_message = (
                f"面试题目：{question.get('question')}\n"
                f"题目类型：{question.get('type')}\n"
                f"题目标签：{', '.join(question.get('tags', []))}\n"
                f"参考答案：{question.get('referenceAnswer')}\n\n"
                f"候选人简历：{resume_info}\n\n"
                f"候选人回答：\n{user_answer}\n\n"
                f"请根据以上信息进行评分。"
            )

        evaluation = chat_completion_json(
            system_prompt=ANSWER_EVALUATION_SYSTEM,
            user_message=user_message,
        )
        # 提取并传递 thinking 字段
        thinking = evaluation.pop("_thinking", "")
        return jsonify({"evaluation": evaluation, "thinking": thinking})
    except ValueError as e:
        return jsonify({"error": "AI response parse failed", "detail": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "AI service error", "detail": str(e)}), 500


@interview_bp.route("/evaluate/stream", methods=["POST"])
def evaluate_answer_stream():
    """
    SSE 流式评估回答 —— 边生成边推送，支持真正的逐字渲染。

    请求格式：同 /evaluate
    响应格式：text/event-stream
      - data: {"content":"文本增量..."}     ← 正文内容
      - data: {"reasoning":"推理增量..."}   ← 思考过程
      - data: [DONE]                        ← 流结束
      - data: {"evaluation":{...}}          ← 最终结构化评分（流结束后发送）
    """
    data = request.get_json(silent=True) or {}
    question = data.get("question")
    user_answer = data.get("userAnswer", "")
    resume_info = data.get("resumeInfo")
    follow_up_context = data.get("followUpContext")

    if not question:
        return jsonify({"error": "question is required"}), 400
    if not user_answer.strip():
        return jsonify({
            "evaluation": {
                "questionId": question.get("id"),
                "totalScore": 0, "accuracy": 0, "completeness": 0,
                "expression": 0, "projectRelevance": 0, "depth": 0,
                "strengths": [], "weaknesses": ["未作答"],
                "improvedAnswer": question.get("referenceAnswer", ""),
                "followUpQuestion": "",
            }
        })

    # 构建 user_message（逻辑与原接口一致）
    if follow_up_context and follow_up_context.get("isFollowUp"):
        user_message = (
            f"【追问环节】候选人已回答了主问题，现在正在回答针对其回答的追问。\n\n"
            f"原始面试题目：{question.get('question')}\n"
            f"题目类型：{question.get('type')}\n"
            f"题目标签：{', '.join(question.get('tags', []))}\n"
            f"参考答案：{question.get('referenceAnswer')}\n\n"
            f"候选人主问题回答：\n{follow_up_context.get('mainAnswer', '')}\n\n"
            f"面试官追问：{follow_up_context.get('followUpQuestion', '')}\n\n"
            f"候选人对追问的回答：\n{user_answer}\n\n"
            f"候选人简历：{resume_info}\n\n"
            f"请针对追问的回答进行评分，重点关注候选人面对追问时的应变能力和知识深度。"
        )
    else:
        user_message = (
            f"面试题目：{question.get('question')}\n"
            f"题目类型：{question.get('type')}\n"
            f"题目标签：{', '.join(question.get('tags', []))}\n"
            f"参考答案：{question.get('referenceAnswer')}\n\n"
            f"候选人简历：{resume_info}\n\n"
            f"候选人回答：\n{user_answer}\n\n"
            f"请根据以上信息进行评分。"
        )

    def generate():
        """SSE 事件生成器 —— 纯文本流式推送"""
        full_text = ""

        try:
            for chunk in chat_completion_stream(
                system_prompt=ANSWER_EVALUATION_SYSTEM,
                user_message=user_message,
            ):
                full_text += chunk
                yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

            # 流结束
            yield "data: [DONE]\n\n"

            # 从最终文本中提取追问（如果有）供前端使用
            import re
            follow_up_match = re.search(
                r"\*\*💬 追问：\*\*\s*\n\s*(.+?)(?:\n\n|\n*$)",
                full_text
            )
            follow_up = follow_up_match.group(1).strip() if follow_up_match else ""
            if follow_up:
                yield f"data: {json.dumps({'followUp': follow_up}, ensure_ascii=False)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲
        },
    )


@interview_bp.route("/report", methods=["POST"])
def generate_report():
    """
    生成面试报告

    请求格式：{ "session": {...} }
    响应格式：{ "report": {...} }
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
        thinking = report.pop("_thinking", "")
        return jsonify({"report": report, "thinking": thinking})
    except ValueError as e:
        return jsonify({"error": "AI response parse failed", "detail": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "AI service error", "detail": str(e)}), 500

"""
POST /api/chat/stream  — SSE streaming chat endpoint
POST /api/chat/stop    — stop the streaming generation
"""

import json
import traceback
from flask import Blueprint, request, Response, stream_with_context
from services.ai_service import chat_completion_stream

chat_bp = Blueprint("chat", __name__)

# In-memory stop flags (per-request via a simple token)
_active_streams: dict[str, bool] = {}


@chat_bp.route("/stream", methods=["POST"])
def chat_stream():
    """
    SSE streaming endpoint for real-time AI output.

    Request:  { "messages": [...], "systemPrompt": "..." }
    Response: SSE event stream (text/event-stream)

    Each chunk is emitted as:
        data: {"content": "text chunk..."}

    Completion signal:
        data: [DONE]

    Error signal:
        data: {"error": "message"}
    """
    data = request.get_json(silent=True) or {}
    messages: list[dict] = data.get("messages", [])
    system_prompt: str = data.get(
        "systemPrompt",
        "你是一位专业的技术面试官。请用中文进行面试对话。",
    )

    if not messages:
        return {"error": "messages array is required"}, 400

    # Extract the last user message; preceding messages become context
    user_message = messages[-1].get("content", "") if messages else ""

    # Build full conversation context from history
    conversation_context = "\n\n".join(
        f"{m['role']}: {m['content']}" for m in messages[:-1]
    )

    full_user_message = (
        f"{conversation_context}\n\n当前提问：{user_message}"
        if conversation_context
        else user_message
    )

    def generate():
        try:
            for chunk in chat_completion_stream(
                system_prompt=system_prompt,
                user_message=full_user_message,
            ):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception:
            yield f"data: {json.dumps({'error': traceback.format_exc()})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

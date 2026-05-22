"""
POST /api/chat/stream  — SSE 流式聊天接口
POST /api/chat/stop    — 停止流式生成

SSE（Server-Sent Events）是一种基于 HTTP 的单向推送协议：
- 服务端保持长连接，持续向客户端推送数据
- 每条消息格式为 "data: <内容>\n\n"
- 流结束标记为 "data: [DONE]\n\n"
- 客户端通过 fetch + ReadableStream 或 EventSource 接收
"""

import json
import traceback
from flask import Blueprint, request, Response, stream_with_context
from services.ai_service import chat_completion_stream

chat_bp = Blueprint("chat", __name__)

# 内存中的流停止标记（通过简单 token 实现按请求粒度控制）
_active_streams: dict[str, bool] = {}


@chat_bp.route("/stream", methods=["POST"])
def chat_stream():
    """
    SSE 流式端点，用于实时 AI 输出。

    请求格式：
        { "messages": [...], "systemPrompt": "..." }

    响应格式（text/event-stream）：
        每个文本块按以下格式发送：
            data: {"content": "文本片段..."}

        完成信号：
            data: [DONE]

        错误信号：
            data: {"error": "错误信息"}

    工作流程：
        1. 接收客户端的多轮对话消息和系统提示词
        2. 提取最后一条用户消息作为当前问题
        3. 将之前的对话作为上下文拼接
        4. 调用 AI 流式接口逐块获取回复
        5. 每个文本块包装为 SSE data 格式发送
        6. 发送完所有块后发送 [DONE] 结束标记
    """
    data = request.get_json(silent=True) or {}
    messages: list[dict] = data.get("messages", [])
    system_prompt: str = data.get(
        "systemPrompt",
        "你是一位专业的技术面试官。请用中文进行面试对话。",
    )

    if not messages:
        return {"error": "messages array is required"}, 400

    # 提取最后一条用户消息作为当前提问
    user_message = messages[-1].get("content", "") if messages else ""

    # 将历史对话拼接为上下文
    conversation_context = "\n\n".join(
        f"{m['role']}: {m['content']}" for m in messages[:-1]
    )

    # 将上下文与当前提问合并
    full_user_message = (
        f"{conversation_context}\n\n当前提问：{user_message}"
        if conversation_context
        else user_message
    )

    def generate():
        """
        SSE 事件生成器（Flask stream_with_context 要求使用生成器函数）。
        
        每迭代一次 AI 流式输出的 chunk，就生成一条 SSE 格式的数据行。
        Flask 的 Response + stream_with_context 会自动将生成器的输出
        以 text/event-stream 格式逐条发送给客户端。
        """
        try:
            for chunk in chat_completion_stream(
                system_prompt=system_prompt,
                user_message=full_user_message,
            ):
                # SSE 标准格式：data: <JSON>\n\n
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            # 流结束标记
            yield "data: [DONE]\n\n"
        except Exception:
            # 发生异常时将错误信息通过 SSE 发送给客户端
            yield f"data: {json.dumps({'error': traceback.format_exc()})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            # 禁止缓存，确保客户端始终获取最新数据
            "Cache-Control": "no-cache",
            # 保持连接开启
            "Connection": "keep-alive",
            # 禁用 Nginx 代理缓冲，确保数据实时推送
            "X-Accel-Buffering": "no",
        },
    )

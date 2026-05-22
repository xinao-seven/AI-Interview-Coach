"""AI 服务模块 —— 封装 OpenAI 兼容的聊天补全 API。

DeepSeek V4 默认启用思考模式，会在输出中混入 reasoning_content。
由于我们的提示词要求输出纯净的 JSON，因此需要禁用思考模式以获取结构化输出。
"""

import json
import re
from openai import OpenAI
from config import Config


_client: OpenAI | None = None


def get_client() -> OpenAI:
    """获取 OpenAI 客户端单例"""
    global _client
    if _client is None:
        _client = OpenAI(api_key=Config.AI_API_KEY, base_url=Config.AI_API_BASE)
    return _client


def _base_params(**overrides):
    """所有补全调用共享的基础参数"""
    params = {
        "model": Config.AI_MODEL,
        "temperature": overrides.get("temperature", Config.TEMPERATURE),
        "max_tokens": overrides.get("max_tokens", Config.MAX_REQUEST_TOKENS),
    }
    # 仅对 DeepSeek 兼容 API 禁用思考模式
    base = (Config.AI_API_BASE or "").lower()
    if "deepseek" in base:
        params["extra_body"] = {"thinking": {"type": "disabled"}}
    return params


def chat_completion(
    system_prompt: str,
    user_message: str,
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    """单轮聊天补全，返回原始文本"""
    client = get_client()
    params = _base_params(temperature=temperature, max_tokens=max_tokens)
    try:
        response = client.chat.completions.create(
            **params,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        raise RuntimeError(
            f"AI API call failed (base={Config.AI_API_BASE}, model={Config.AI_MODEL}): {e}"
        )


def chat_completion_json(
    system_prompt: str,
    user_message: str,
    *,
    temperature: float | None = None,
) -> dict:
    """聊天补全并返回解析后的 JSON 字典。

    JSON 提取策略（按优先级依次尝试）：
    1. 直接对完整响应调用 json.loads
    2. 从 ```json ... ``` 代码块中提取
    3. 通过括号匹配找到最外层的 { ... } 对
    """
    text = chat_completion(system_prompt, user_message, temperature=temperature)

    # 1 — 直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 2 — 从代码块中提取
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 3 — 通过括号平衡匹配提取 JSON（处理嵌套对象）
    start = text.find("{")
    if start == -1:
        raise ValueError(f"No JSON object found in AI response: {text[:300]}...")

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                candidate = text[start:i + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    raise ValueError(
                        f"Found JSON-like text but failed to parse: {candidate[:200]}..."
                    )
    raise ValueError(f"Unclosed JSON object in AI response: {text[:300]}...")


def chat_completion_stream(
    system_prompt: str,
    user_message: str,
    *,
    temperature: float | None = None,
):
    """流式聊天补全，逐块产出文本增量（生成器）"""
    client = get_client()
    params = _base_params(temperature=temperature)
    try:
        stream = client.chat.completions.create(
            **params,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content
    except Exception as e:
        raise RuntimeError(
            f"AI stream failed (base={Config.AI_API_BASE}, model={Config.AI_MODEL}): {e}"
        )

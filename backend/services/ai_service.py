"""AI 服务模块 —— 封装 OpenAI 兼容的聊天补全 API。

支持 DeepSeek 等推理模型的思考模式（thinking mode）。
当 AI_ENABLE_THINKING=True 时：
- 禁用思考的 extra_body 不会被添加
- reasoning_content 会被提取并随响应返回
- 结构化 JSON 输出会包含 thinking 字段
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
    # DeepSeek 思考模式控制：仅当 AI_ENABLE_THINKING=False 时才禁用
    base = (Config.AI_API_BASE or "").lower()
    if "deepseek" in base and not Config.AI_ENABLE_THINKING:
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


def chat_completion_with_thinking(
    system_prompt: str,
    user_message: str,
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> tuple[str, str]:
    """
    聊天补全并返回 (thinking, content) 元组。
    
    thinking 来源优先级：
    1. API 返回的 reasoning_content 字段（DeepSeek 原生）
    2. content 中 <thinking>...</thinking> 标签的内容
    
    content 会去除 <thinking> 标签后返回。
    """
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
        msg = response.choices[0].message
        content = msg.content or ""
        
        # 1. 优先从 API 原生 reasoning_content 获取
        reasoning = getattr(msg, "reasoning_content", "") or ""
        
        # 2. 补充：从 content 中提取 <thinking>...</thinking>
        think_match = re.search(
            r"<thinking>\s*([\s\S]*?)\s*</thinking>", content, re.IGNORECASE
        )
        if think_match:
            extracted = think_match.group(1).strip()
            if extracted:
                reasoning = (reasoning + "\n\n" + extracted).strip() if reasoning else extracted
            # 从 content 中移除 thinking 块，保留纯净 JSON
            content = re.sub(
                r"<thinking>\s*[\s\S]*?\s*</thinking>\s*", "", content, flags=re.IGNORECASE
            ).strip()
        
        return reasoning, content
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
    """聊天补全并返回解析后的 JSON + thinking。

    当 AI_ENABLE_THINKING=True 时，额外调用 chat_completion_with_thinking
    提取推理过程并放进返回 dict 的 `_thinking` 字段。
    """
    if Config.AI_ENABLE_THINKING:
        thinking, text = chat_completion_with_thinking(
            system_prompt, user_message, temperature=temperature
        )
        result = _extract_json(text)
        if thinking:
            result["_thinking"] = thinking
        return result
    else:
        text = chat_completion(system_prompt, user_message, temperature=temperature)
        return _extract_json(text)


def _extract_json(text: str) -> dict:
    """从 AI 返回文本中提取 JSON 对象（四级降级策略）。

    1. <!--EVAL{...}--> 注释提取（新评分格式）
    2. 直接 json.loads
    3. ```json ... ``` 代码块提取
    4. 括号平衡匹配提取最外层 { ... }
    """
    # 0 — HTML 注释中的 EVAL JSON（优先级最高，最精准）
    comment_match = re.search(r"<!--\s*EVAL\s*(\{[\s\S]*?\})\s*-->", text)
    if comment_match:
        try:
            return json.loads(comment_match.group(1))
        except json.JSONDecodeError:
            pass

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

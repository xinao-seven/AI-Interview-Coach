"""AI service — wraps OpenAI-compatible chat completion API.

DeepSeek V4 defaults to thinking mode, which mixes reasoning_content
into the output. Since our prompts ask for clean JSON, we disable
thinking to get structured output directly.
"""

import json
import re
from openai import OpenAI
from config import Config


_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=Config.AI_API_KEY, base_url=Config.AI_API_BASE)
    return _client


def _base_params(**overrides):
    """Common parameters shared by all completion calls."""
    return {
        "model": Config.AI_MODEL,
        "temperature": overrides.get("temperature", Config.TEMPERATURE),
        "max_tokens": overrides.get("max_tokens", Config.MAX_REQUEST_TOKENS),
        # Disable thinking mode — we need clean JSON, not reasoning traces
        "extra_body": {"thinking": {"type": "disabled"}},
    }


def chat_completion(
    system_prompt: str,
    user_message: str,
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    """Single-turn chat completion, returns raw text."""
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
    """Chat completion that returns a parsed JSON dict.

    Extraction strategy (tried in order):
    1. Direct json.loads on the full response
    2. Extract from ```json ... ``` fence
    3. Find the outermost { ... } pair via bracket matching
    """
    text = chat_completion(system_prompt, user_message, temperature=temperature)

    # 1 — direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 2 — code fence
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 3 — bracket-balanced JSON extraction (handles nested objects)
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
    """Streaming chat completion, yields text deltas."""
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

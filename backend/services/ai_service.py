"""AI service — wraps OpenAI-compatible chat completion API."""

import json
import re
from openai import OpenAI
from config import Config


_client: OpenAI | None = None


def get_client() -> OpenAI:
    """Lazy-init OpenAI client with configured base URL and key."""
    global _client
    if _client is None:
        _client = OpenAI(api_key=Config.AI_API_KEY, base_url=Config.AI_API_BASE)
    return _client


def chat_completion(
    system_prompt: str,
    user_message: str,
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    """Send a single-turn chat completion and return the raw text response."""
    client = get_client()
    response = client.chat.completions.create(
        model=Config.AI_MODEL,
        temperature=temperature or Config.TEMPERATURE,
        max_tokens=max_tokens or Config.MAX_REQUEST_TOKENS,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )
    return response.choices[0].message.content or ""


def chat_completion_json(
    system_prompt: str,
    user_message: str,
    *,
    temperature: float | None = None,
) -> dict:
    """
    Send a chat completion expecting a JSON response.
    Tries to extract JSON from code fences if the model wraps it.
    """
    text = chat_completion(system_prompt, user_message, temperature=temperature)

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to extract from ```json ... ``` block
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Last resort: try to find a JSON object in the text
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Failed to parse JSON from AI response: {text[:200]}...")


def chat_completion_stream(
    system_prompt: str,
    user_message: str,
    *,
    temperature: float | None = None,
):
    """
    Yield content deltas from a streaming chat completion.
    Each yielded value is a string chunk.
    """
    client = get_client()
    stream = client.chat.completions.create(
        model=Config.AI_MODEL,
        temperature=temperature or Config.TEMPERATURE,
        max_tokens=Config.MAX_REQUEST_TOKENS,
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

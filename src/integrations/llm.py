from __future__ import annotations

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from src.config import settings

logger = structlog.get_logger()

_llm_cache: dict[str, ChatOpenAI] = {}


def get_llm(
    model: str | None = None, temperature: float = 0.3, max_tokens: int = 4096
) -> ChatOpenAI:
    """Get a ChatOpenAI instance for the given model and settings."""
    model = model or settings.llm_model
    cache_key = f"{model}:{temperature}:{max_tokens}"
    if cache_key not in _llm_cache:
        _llm_cache[cache_key] = ChatOpenAI(
            openai_api_key=settings.requesty_api_key,
            openai_api_base=settings.requesty_base_url,
            model_name=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    return _llm_cache[cache_key]


async def call_llm(
    prompt: str,
    system_prompt: str = "",
    model: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    """Call an LLM via Requesty with the given model."""
    llm = get_llm(model, temperature=temperature, max_tokens=max_tokens)

    messages = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))
    messages.append(HumanMessage(content=prompt))

    logger.info("llm_call", model=model or settings.llm_model, prompt_length=len(prompt))

    response = await llm.ainvoke(messages)

    text = response.content if isinstance(response.content, str) else str(response.content)
    logger.info("llm_response", response_length=len(text))
    return text


async def call_bedrock(
    prompt: str,
    system_prompt: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    """Backward-compatible wrapper — calls default model."""
    return await call_llm(
        prompt,
        system_prompt=system_prompt,
        max_tokens=max_tokens,
        temperature=temperature,
    )

from __future__ import annotations

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from src.config import settings

logger = structlog.get_logger()

_llm: ChatOpenAI | None = None


def get_llm() -> ChatOpenAI:
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(
            openai_api_key=settings.requesty_api_key,
            openai_api_base=settings.requesty_base_url,
            model_name=settings.llm_model,
            temperature=0.3,
        )
    return _llm


async def call_bedrock(
    prompt: str,
    system_prompt: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    llm = get_llm()
    llm.temperature = temperature

    messages = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))
    messages.append(HumanMessage(content=prompt))

    logger.info("llm_call", model=settings.llm_model, prompt_length=len(prompt))

    response = await llm.ainvoke(messages)

    text = response.content if isinstance(response.content, str) else str(response.content)
    logger.info("llm_response", response_length=len(text))
    return text

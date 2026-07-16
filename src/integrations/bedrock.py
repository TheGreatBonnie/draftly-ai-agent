from __future__ import annotations

import json
import structlog
import boto3

from src.config import settings

logger = structlog.get_logger()

_client = None


def get_bedrock_client():
    global _client
    if _client is None:
        _client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
    return _client


async def call_bedrock(
    prompt: str,
    system_prompt: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    client = get_bedrock_client()

    messages = [{"role": "user", "content": [{"text": prompt}]}]

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": messages,
    }

    if system_prompt:
        body["system"] = [{"text": system_prompt}]

    logger.info("bedrock_call", model=settings.bedrock_model, prompt_length=len(prompt))

    response = client.invoke_model(
        modelId=settings.bedrock_model,
        body=json.dumps(body),
        contentType="application/json",
        accept="application/json",
    )

    response_body = json.loads(response["body"].read())
    content = response_body.get("content", [{}])
    text = content[0].get("text", "") if content else ""

    logger.info("bedrock_response", response_length=len(text))
    return text


async def call_bedrock_with_tools(prompt: str, tools: list[dict], system_prompt: str = "") -> dict:
    client = get_bedrock_client()

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": [{"text": prompt}]}],
        "tools": tools,
    }

    if system_prompt:
        body["system"] = [{"text": system_prompt}]

    response = client.invoke_model(
        modelId=settings.bedrock_model,
        body=json.dumps(body),
        contentType="application/json",
        accept="application/json",
    )

    return json.loads(response["body"].read())

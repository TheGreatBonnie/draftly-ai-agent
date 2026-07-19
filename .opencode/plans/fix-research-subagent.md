# Fix research_node_hybrid Subagent Integration

## Context

The current `research_node_hybrid` in `src/agents/nodes/research.py` imports `research_analyst_subagent` but never uses it. The plan describes using subagents for concurrent research tasks, but the implementation just does the same `asyncio.gather` fetch as the standard node.

## Issues to Fix

### Issue 1: Subagents defined without tools
**File:** `src/agents/subagents/__init__.py`

The subagent dictionaries don't include `tools`. According to the deepagents docs, subagents can have tools that they can use during execution.

### Issue 2: No `create_deep_agent` invocation
**File:** `src/agents/nodes/research.py:54-110`

The `research_node_hybrid` should:
1. Create a deep agent with the research subagent
2. Invoke the agent with the research question
3. The agent will automatically use the `task` tool to delegate to the subagent

### Issue 3: Skills and investigation plan not integrated
The `research_skill` and `investigation_plan` are computed but never passed to the agent.

## Implementation Steps

### Step 1: Update subagents with tools

**File:** `src/agents/subagents/__init__.py`

Add tools to the research subagent definition:
```python
from src.agents.tools.github_tools import search_github_issues, get_github_issue
from src.agents.tools.slack_tools import search_slack_messages

research_analyst_subagent = {
    "name": "research-analyst",
    "description": "Research a specific documentation topic and return findings with citations",
    "system_prompt": RESEARCH_ANALYST_INSTRUCTIONS,
    "tools": [search_github_issues, get_github_issue, search_slack_messages],
}
```

### Step 2: Update research_node_hybrid

**File:** `src/agents/nodes/research.py`

Replace the current implementation with:
```python
async def research_node_hybrid(state: DocumentationState) -> dict:
    """Enhanced research node with subagent patterns and parallel execution."""
    from deepagents import create_deep_agent

    from src.agents.middleware.rubric import create_rubric_middleware
    from src.agents.subagents import research_analyst_subagent
    from src.agents.skills import get_skill_for_question
    from src.agents.planners.investigation import create_investigation_plan
    from src.config import settings

    question = state["question"]
    org_id = state["org_id"]

    logger.info("research_hybrid_started", org_id=org_id)

    # Get research skill
    research_skill = get_skill_for_question(question, "research")
    
    # Create investigation plan
    investigation_plan = create_investigation_plan(question)

    # Create deep agent with research subagent
    agent = create_deep_agent(
        model=settings.deepagents_model,
        system_prompt=(
            "You are a research coordinator. Use the research-analyst subagent "
            "to gather information from GitHub and Slack. Synthesize findings "
            "into a comprehensive research summary."
        ),
        subagents=[research_analyst_subagent],
    )

    # Build research prompt with skill guidance
    skill_strategy = research_skill.get("strategy", {})
    research_focus = skill_strategy.get("focus", "general research")
    
    prompt = (
        f"Research the following question and return a comprehensive summary:\n\n"
        f"Question: {question}\n\n"
        f"Research focus: {research_focus}\n\n"
        f"Investigation plan tasks:\n"
    )
    for i, task in enumerate(investigation_plan[:5], 1):
        prompt += f"{i}. {task.get('description', task.get('task', 'Unknown'))}\n"

    # Invoke agent - it will use task tool to delegate to research-analyst
    result = await agent.ainvoke({
        "messages": [{"role": "user", "content": prompt}],
    })

    # Extract results from messages
    messages = result.get("messages", [])
    last_message = messages[-1].content if messages else ""

    # Parse research results
    # The subagent returns findings, we need to structure them
    github_context = []
    slack_context = []

    # Check for tool call results in messages
    for msg in messages:
        if hasattr(msg, "tool_call_id"):  # Tool message
            content = msg.content if isinstance(msg.content, str) else str(msg.content)
            if "github" in content.lower() or "issue" in content.lower():
                github_context.append(content)
            elif "slack" in content.lower() or "message" in content.lower():
                slack_context.append(content)

    # If no tool results found, use the final message as research summary
    if not github_context and not slack_context:
        github_context = [last_message] if last_message else []
        slack_context = []

    logger.info(
        "research_hybrid_completed",
        github=len(github_context),
        slack=len(slack_context),
        skill=research_skill.get("name", "none"),
        plan_tasks=len(investigation_plan),
    )

    return {
        "github_context": github_context,
        "slack_context": slack_context,
        "research_skill": research_skill,
        "investigation_plan": investigation_plan,
        "subagent_results": {
            "summary": last_message,
            "github_findings": github_context,
            "slack_findings": slack_context,
        },
    }
```

## Files to Modify

- `src/agents/subagents/__init__.py` (add tools to subagent)
- `src/agents/nodes/research.py` (use create_deep_agent)

## Verification

1. Run `ruff check src/agents/subagents/__init__.py src/agents/nodes/research.py`
2. Verify imports work: `python -c "from src.agents.nodes.research import research_node_hybrid"`

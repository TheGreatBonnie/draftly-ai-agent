# Implementation Plan: Deep Agents + LangGraph Hybrid

**Date:** 2025-07-19
**Feature:** Integrate Deep agents capabilities into existing LangGraph workflow
**Status:** Ready for implementation

---

## Overview

Enhance Draftly's LangGraph pipeline with Deep agents capabilities:
1. **Rubric Grading** - Replace simple confidence scoring with LLM-as-a-judge
2. **Parallel Research** - Use subagents for concurrent research tasks
3. **Skills-Guided Retrieval** - Adaptive research strategies
4. **Todo-Driven Investigation** - Break complex questions into tasks

---

## Architecture

### Current State
```
┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌───────────┐
│ Ingest  │───▶│ Memory       │───▶│ Research │───▶│ Synthesize│
└─────────┘    └──────────────┘    └──────────┘    └───────────┘
                                                       │
                                                       ▼
  ┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌───────────┐
  │ Publish │◀───│ Human Review │◀───│ AI       │◀───│ Write     │
  │         │    │ (HITL)       │    │ Review   │    │ Docs      │
  └─────────┘    └──────────────┘    └──────────┘    └───────────┘
```

### Hybrid State
```
┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌───────────┐
│ Ingest  │───▶│ Memory       │───▶│ Research │───▶│ Synthesize│
└─────────┘    └──────────────┘    │(Subagent)│    └───────────┘
                                   └──────────┘          │
                                                         ▼
  ┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌───────────┐
  │ Publish │◀───│ Human Review │◀───│ Rubric   │◀───│ Write     │
  │         │    │ (HITL)       │    │ Grading  │    │ Docs      │
  └─────────┘    └──────────────┘    └──────────┘    └───────────┘
```

---

## Phase 1: Configuration

### 1.1 Add Deep agents settings

**File:** `src/config.py`

```python
# Deep agents
deepagents_model: str = "anthropic:claude-sonnet-4-6"
rubric_grader_model: str = "anthropic:claude-haiku-4-5"
rubric_max_iterations: int = 3
research_max_concurrent: int = 3
```

### 1.2 Add dependencies

**File:** `pyproject.toml`

```toml
dependencies = [
    # ... existing ...
    "deepagents>=0.6.5",
]
```

---

## Phase 2: Rubric Grading

### 2.1 Create rubric configuration

**File:** `src/agents/rubrics.py`

```python
# Documentation quality rubric
DOCUMENTATION_RUBRIC = """
## Documentation Quality Criteria

### Accuracy
- All API references are correct and exist
- Code examples are syntactically valid
- Configuration options match actual settings

### Completeness
- Original question is fully addressed
- All steps are clearly documented
- Edge cases and error handling covered

### Clarity
- Written in clear, concise language
- Logical structure with headings
- Appropriate for target audience

### Grounding
- Claims are supported by retrieved sources
- No hallucinated APIs or functions
- Citations provided where appropriate

### Format
- Correct doc_type selected (faq, tutorial, reference, troubleshooting)
- Appropriate length for content type
- Proper markdown formatting
"""
```

### 2.2 Create rubric middleware wrapper

**File:** `src/agents/middleware/rubric.py`

```python
from deepagents import RubricMiddleware
from src.config import settings

def create_rubric_middleware():
    """Create RubricMiddleware for documentation quality grading."""
    return RubricMiddleware(
        model=settings.rubric_grader_model,
        system_prompt="You are a documentation quality reviewer...",
        max_iterations=settings.rubric_max_iterations,
        on_evaluation=log_evaluation,
    )

def log_evaluation(ev):
    """Log rubric evaluation results."""
    logger.info(
        "rubric_evaluation",
        iteration=ev["iteration"],
        result=ev["result"],
        explanation=ev["explanation"],
    )
```

### 2.3 Update ai_review node

**File:** `src/agents/nodes/review.py`

```python
from deepagents import create_deep_agent
from src.agents.middleware.rubric import create_rubric_middleware

async def ai_review_node(state: DocumentationState) -> dict:
    """AI review with rubric-based grading."""
    
    rubric_middleware = create_rubric_middleware()
    
    review_agent = create_deep_agent(
        model=settings.deepagents_model,
        tools=[validate_documentation],
        middleware=[rubric_middleware],
    )
    
    # Build review prompt
    review_prompt = f"""
    Review this documentation for quality:
    
    Title: {state.get('draft_title')}
    Content: {state.get('draft_content')}
    Type: {state.get('doc_type')}
    Question: {state['question']}
    """
    
    # Invoke with rubric
    result = await review_agent.ainvoke({
        "messages": [HumanMessage(content=review_prompt)],
        "rubric": DOCUMENTATION_RUBRIC,
    })
    
    # Extract confidence from rubric results
    confidence = extract_confidence_from_rubric(result)
    
    return {
        "confidence_score": confidence,
        "ai_reviewer_feedback": extract_feedback(result),
    }
```

---

## Phase 3: Parallel Research

### 3.1 Create research subagent

**File:** `src/agents/subagents/research.py`

```python
RESEARCH_ANALYST_INSTRUCTIONS = """
You are a research analyst specializing in documentation research.

Given a specific research question:
1. Search web for relevant documentation
2. Search official docs for API references
3. Look for code examples and tutorials
4. Extract key facts and citations

Return a structured summary with:
- Key findings
- Source URLs
- Code examples (if applicable)
- Confidence assessment (high/medium/low)
"""

research_analyst_subagent = {
    "name": "research-analyst",
    "description": "Research a specific documentation topic",
    "system_prompt": RESEARCH_ANALYST_INSTRUCTIONS,
}
```

### 3.2 Update research node

**File:** `src/agents/nodes/research.py`

```python
from deepagents import create_deep_agent
from src.agents.subagents.research import research_analyst_subagent

async def research_node(state: DocumentationState) -> dict:
    """Research with parallel subagent delegation."""
    
    # Break question into sub-questions
    sub_questions = await decompose_question(state["question"])
    
    # Create research agent with subagent
    research_agent = create_deep_agent(
        model=settings.deepagents_model,
        tools=[search_web, search_documentation],
        subagents=[research_analyst_subagent],
    )
    
    # Launch parallel research tasks
    research_tasks = []
    for sub_q in sub_questions:
        task = research_agent.task(
            "research-analyst",
            f"Research: {sub_q}"
        )
        research_tasks.append(task)
    
    # Execute in parallel
    results = await asyncio.gather(*research_tasks)
    
    # Synthesize results
    web_context = []
    doc_context = []
    for result in results:
        web_context.extend(result.get("web_findings", []))
        doc_context.extend(result.get("doc_findings", []))
    
    return {
        "web_context": web_context,
        "doc_context": doc_context,
    }
```

---

## Phase 4: Skills-Guided Retrieval

### 4.1 Create research skills

**File:** `src/agents/skills/research.py`

```python
RESEARCH_SKILLS = {
    "api_question": """
    # API Research Strategy
    1. Search official documentation first
    2. Look for API reference pages
    3. Check for code examples
    4. Search Stack Overflow for common issues
    5. Verify API exists and is current
    """,
    
    "configuration": """
    # Configuration Research Strategy
    1. Search for official configuration guides
    2. Look for environment variable documentation
    3. Check GitHub examples and templates
    4. Search for best practices blog posts
    """,
    
    "troubleshooting": """
    # Troubleshooting Research Strategy
    1. Search for error message exactly
    2. Look for GitHub issues with same problem
    3. Check Stack Overflow solutions
    4. Search for community forum posts
    """,
}
```

### 4.2 Update ingest node

**File:** `src/agents/nodes/ingest.py`

```python
from src.agents.skills.research import RESEARCH_SKILLS

async def ingest_node(state: DocumentationState) -> dict:
    """Ingest and classify question for skill selection."""
    
    question = state["question"]
    
    # Classify question type
    question_type = await classify_question(question)
    
    # Select appropriate research skill
    skill = RESEARCH_SKILLS.get(question_type, RESEARCH_SKILLS["api_question"])
    
    return {
        "question": question,
        "question_type": question_type,
        "research_skill": skill,
    }
```

---

## Phase 5: Todo-Driven Investigation

### 5.1 Create investigation planner

**File:** `src/agents/planners/investigation.py`

```python
INVESTIGATION_PLAN_PROMPT = """
Break this documentation question into a research plan:

Question: {question}

Create a todo list of:
1. Specific search queries to run
2. Documentation pages to check
3. Code examples to find
4. Validation steps to perform

Format as JSON array of tasks.
"""

async def create_investigation_plan(question: str) -> list[dict]:
    """Create a todo-driven investigation plan."""
    
    planner_agent = create_deep_agent(
        model=settings.deepagents_model,
        tools=[],  # Planning only
    )
    
    result = await planner_agent.ainvoke({
        "messages": [HumanMessage(content=INVESTIGATION_PLAN_PROMPT.format(question=question))],
    })
    
    # Parse plan from response
    return parse_plan_from_response(result)
```

### 5.2 Update research node with planning

**File:** `src/agents/nodes/research.py`

```python
async def research_node_with_planning(state: DocumentationState) -> dict:
    """Research with todo-driven investigation."""
    
    # Create investigation plan
    plan = await create_investigation_plan(state["question"])
    
    # Create research agent with todo tools
    research_agent = create_deep_agent(
        model=settings.deepagents_model,
        tools=[search_web, search_documentation, write_todos],
    )
    
    # Execute plan
    result = await research_agent.ainvoke({
        "messages": [HumanMessage(content=f"Investigate: {state['question']}")],
        "todos": plan,
    })
    
    # Extract findings
    return extract_findings_from_result(result)
```

---

## Phase 6: Graph Integration

### 6.1 Update graph.py

**File:** `src/agents/graph.py`

```python
def build_hybrid_graph():
    """Build enhanced graph with Deep agents capabilities."""
    
    graph = StateGraph(DocumentationState)
    
    # Add nodes
    graph.add_node("ingest", ingest_node)
    graph.add_node("memory_retrieve", memory_retrieve_node)
    graph.add_node("research", research_node_with_planning)  # Enhanced
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("write_docs", write_docs_node)
    graph.add_node("ai_review", ai_review_node)  # Enhanced with rubric
    graph.add_node("human_review", human_review_node)
    graph.add_node("publish", publish_node)
    
    # Same edges as before
    graph.set_entry_point("ingest")
    graph.add_edge("ingest", "memory_retrieve")
    graph.add_edge("memory_retrieve", "research")
    graph.add_edge("research", "synthesize")
    graph.add_edge("synthesize", "write_docs")
    graph.add_edge("write_docs", "ai_review")
    
    # Rubric-based routing (replaces confidence threshold)
    graph.add_conditional_edges(
        "ai_review",
        lambda state: route_by_rubric(state),
        {"human_review": "human_review", "research": "research", "publish": "publish"},
    )
    
    # HITL routing (same as before)
    graph.add_conditional_edges(
        "human_review",
        lambda state: {
            "approve": "publish",
            "reject": END,
            "revise": "write_docs",
        }.get(state.get("human_decision", ""), END),
    )
    
    graph.add_edge("publish", END)
    
    return graph

def route_by_rubric(state):
    """Route based on rubric evaluation results."""
    rubric_status = state.get("rubric_status", {})
    
    if rubric_status.get("satisfied"):
        return "publish"
    elif rubric_status.get("needs_revision"):
        return "research" if rubric_status.get("research_needed") else "write_docs"
    else:
        return "human_review"
```

---

## Phase 7: State Updates

### 7.1 Update state schema

**File:** `src/agents/state.py`

```python
class DocumentationState(TypedDict):
    # ... existing fields ...
    
    # Deep agents fields
    question_type: str  # api_question, configuration, troubleshooting
    research_skill: str  # Selected research strategy
    investigation_plan: list[dict]  # Todo-driven plan
    rubric_status: dict  # Rubric evaluation results
    subagent_results: list[dict]  # Parallel research results
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/config.py` | Modify | Add Deep agents settings |
| `pyproject.toml` | Modify | Add deepagents dependency |
| `src/agents/rubrics.py` | Create | Documentation quality rubric |
| `src/agents/middleware/rubric.py` | Create | RubricMiddleware wrapper |
| `src/agents/subagents/research.py` | Create | Research subagent |
| `src/agents/skills/research.py` | Create | Research strategies |
| `src/agents/planners/investigation.py` | Create | Todo-driven planner |
| `src/agents/nodes/review.py` | Modify | Add rubric grading |
| `src/agents/nodes/research.py` | Modify | Add parallel research |
| `src/agents/nodes/ingest.py` | Modify | Add skill selection |
| `src/agents/graph.py` | Modify | Update routing logic |
| `src/agents/state.py` | Modify | Add new state fields |
| `tests/test_rubric.py` | Create | Rubric tests |
| `tests/test_subagents.py` | Create | Subagent tests |

---

## Implementation Order

| Step | Task | Branch | Time |
|------|------|--------|------|
| 1 | Config updates | `feature/deepagents-config` | 30 min |
| 2 | Add deepagents dependency | `feature/deepagents-deps` | 15 min |
| 3 | Create rubric configuration | `feature/rubric-config` | 1 hour |
| 4 | Create rubric middleware | `feature/rubric-middleware` | 1 hour |
| 5 | Update ai_review node | `feature/rubric-review` | 1.5 hours |
| 6 | Create research subagent | `feature/research-subagent` | 1 hour |
| 7 | Create research skills | `feature/research-skills` | 1 hour |
| 8 | Create investigation planner | `feature/investigation-planner` | 1 hour |
| 9 | Update research node | `feature/research-enhanced` | 1.5 hours |
| 10 | Update graph routing | `feature/graph-hybrid` | 1 hour |
| 11 | Update state schema | `feature/state-update` | 30 min |
| 12 | Create tests | `feature/deepagents-tests` | 1.5 hours |
| 13 | Documentation | `docs/deepagents` | 30 min |

**Total estimated time:** ~12 hours

---

## Success Criteria

1. Rubric grading replaces confidence threshold
2. Research runs in parallel via subagents
3. Skills guide research strategy selection
4. Complex questions broken into investigation plans
5. All existing tests pass
6. New tests cover hybrid features

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Deep agents API changes | Pin version, monitor releases |
| Performance overhead | Profile parallel execution |
| Context window limits | Offload to filesystem backend |
| Grader failures | Fallback to confidence scoring |

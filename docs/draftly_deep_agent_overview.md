I actually think **LangChain Deep Agents** is a better fit than LangGraph for this particular project.

Why? Because your workflow is **goal-oriented rather than workflow-oriented**.

With LangGraph, you explicitly define every node, edge, interrupt, and transition. It's excellent for deterministic workflows.

With **Deep Agents**, you give the agent a high-level goal and equip it with specialized subagents. The main agent plans, delegates, and iterates until the objective is achieved. That mirrors how a human documentation engineer works.

For **Draftly**, I would design it as a hierarchy of collaborating agents.

---

# High-Level Architecture

```text
                  User Request
                        │
                        ▼
            Documentation Engineer Agent
                 (Deep Agent)
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
 Context Agent     Research Agent    Memory Agent
       │                │                │
       ▼                ▼                ▼
 GitHub            Slack          CockroachDB
 Discord           Existing Docs  Vector Search
       │                │                │
       └────────────────┼────────────────┘
                        ▼
             Documentation Writer Agent
                        │
                        ▼
               Documentation Reviewer
                        │
             Confidence Evaluation
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
 High Confidence                Needs Human Review
        │                               │
        ▼                               ▼
 Publish Queue                  HITL Review Portal
        │                               │
        └───────────────┬───────────────┘
                        ▼
             Publishing Agent
                        │
       Slack │ Discord │ GitHub │ Docs
                        │
                        ▼
         Update CockroachDB Memory
```

Notice that the **Deep Agent** orchestrates the subagents rather than following a fixed graph.

---

# Core Philosophy

Instead of saying:

> First retrieve memory.

> Then research.

> Then write.

You simply tell the main agent:

> Create the best possible documentation for this support thread.

The Deep Agent decides:

- what information it needs,
- which subagents to call,
- whether more research is necessary,
- when to stop.

That autonomy is one of the strengths of Deep Agents.

---

# Main Agent

The root agent acts like an engineering manager.

Its responsibilities include:

- understanding the user's goal,
- planning the work,
- assigning tasks,
- combining results,
- determining when the objective has been met.

It never performs detailed work itself.

---

# Suggested Subagents

I would build approximately ten focused subagents.

## 1. Memory Agent

The Memory Agent is the most important component because CockroachDB is the heart of the system.

Responsibilities:

- retrieve similar support threads,
- retrieve related documentation,
- retrieve reviewer feedback,
- retrieve approval history,
- search embeddings,
- search episodic memory,
- search semantic memory,
- update long-term memory.

Example tasks:

```
Find documentation about authentication.

Retrieve similar Slack threads.

Find GitHub issues related to OAuth.

Retrieve reviewer comments.

Store this new approval.
```

Unlike a traditional RAG system, this agent can query transactional records, vector embeddings, and historical workflow state.

---

# 2. GitHub Agent

Responsible for:

- Issues
- Discussions
- Pull Requests
- Release Notes
- Commits
- Wiki

It understands GitHub structure rather than simply calling APIs.

---

# 3. Slack Agent

Responsible for:

- reading conversations,
- reconstructing threads,
- identifying accepted answers,
- extracting FAQs,
- identifying subject-matter experts.

---

# 4. Discord Agent

Similar to the Slack Agent but optimized for:

- channels,
- forums,
- threads,
- reactions,
- pinned messages.

---

# 5. Research Agent

The Research Agent coordinates external knowledge gathering.

It decides whether to:

- search GitHub,
- search Slack,
- search Discord,
- query CockroachDB memory,
- retrieve existing documentation,
- search the web (if allowed).

It returns structured evidence rather than prose.

---

# 6. Knowledge Synthesis Agent

One of the most valuable additions.

Instead of writing documentation immediately, it:

- removes duplicate information,
- resolves conflicting answers,
- builds a unified explanation,
- identifies knowledge gaps,
- generates citations.

This produces much higher-quality drafts.

---

# 7. Documentation Writer

The writer converts structured knowledge into documentation.

Supported outputs could include:

- tutorials,
- FAQs,
- troubleshooting guides,
- API references,
- migration guides,
- best practices,
- release notes.

It focuses on writing, not researching.

---

# 8. Documentation Reviewer

Rather than relying on the writer to self-check, dedicate a reviewer agent to verify:

- factual consistency,
- unsupported claims,
- broken links,
- code examples,
- formatting,
- writing style,
- completeness.

It also produces a confidence score.

---

# 9. HITL Agent

This agent manages the human review lifecycle.

Responsibilities:

- create review requests,
- notify reviewers,
- collect feedback,
- compare edits,
- update reviewer memory,
- resume the workflow after approval.

Human edits become training signals for future drafts.

---

# 10. Publishing Agent

Responsible for distribution.

Possible destinations:

- GitHub Docs,
- Docusaurus,
- MkDocs,
- Notion,
- Slack,
- Discord,
- GitHub comments.

It also versions documentation and records publication metadata.

---

# Example Workflow

Imagine a user asks in Slack:

> "How do I configure CockroachDB MCP with Claude Code?"

The Documentation Engineer Agent receives the goal.

### Step 1: Understand the request

The main agent recognizes that this is a documentation request and determines it needs context from previous support discussions, GitHub issues, and existing documentation.

---

### Step 2: Delegate research

It invokes:

- Memory Agent
- Slack Agent
- GitHub Agent
- Research Agent

These agents gather:

- similar Slack threads,
- GitHub issues,
- previous tutorials,
- reviewer notes,
- existing documentation.

---

### Step 3: Synthesize

The Knowledge Synthesis Agent merges the evidence into a coherent knowledge package, removing duplicates and highlighting inconsistencies.

---

### Step 4: Draft

The Documentation Writer produces:

- a how-to guide,
- prerequisites,
- setup instructions,
- troubleshooting,
- examples.

---

### Step 5: Review

The Documentation Reviewer checks:

- hallucinations,
- missing steps,
- code accuracy,
- documentation style.

If confidence is low, it can request additional research before proceeding.

---

### Step 6: Human approval

The HITL Agent sends the draft to reviewers.

A reviewer might comment:

> Add an example showing multiple MCP servers.

The system records:

- the feedback,
- the updated version,
- who approved it,
- why changes were made.

This feedback is stored as long-term organizational memory.

---

### Step 7: Publish

The Publishing Agent:

- updates the documentation site,
- posts the approved answer to Slack,
- replies in Discord,
- comments on the GitHub issue,
- stores the final artifact and its metadata in CockroachDB.

---

# Why This Is Stronger Than a Fixed Workflow

The biggest advantage is adaptability.

A graph-based workflow always follows predefined paths.

A Deep Agent can decide to:

- perform more research if evidence is weak,
- skip unnecessary steps,
- invoke the same subagent multiple times,
- consult additional sources when conflicts arise.

This dynamic behavior makes the system feel more like an autonomous documentation engineer than a scripted pipeline.

---

# Aligning with CockroachDB's "Agentic Memory" Theme

One enhancement I would make is introducing **memory-aware subagents**. Instead of every subagent directly querying external systems, they first consult the Memory Agent, which uses CockroachDB as the centralized memory layer. This creates a hub-and-spoke architecture:

```text
                    Documentation Engineer
                             │
      ┌──────────────────────┼──────────────────────┐
      ▼                      ▼                      ▼
 GitHub Agent          Slack Agent          Writer Agent
      │                      │                      │
      └───────────────┬──────┴───────────────┬──────┘
                      ▼                      ▼
                 Memory Agent (CockroachDB)
                      │
     ┌────────────────────────────────────────────────┐
     │ Episodic Memory (threads, issues, reviews)     │
     │ Semantic Memory (vector embeddings)            │
     │ Procedural Memory (workflow/task state)        │
     │ Organizational Memory (approved knowledge)     │
     │ Reviewer Memory (feedback and edit history)    │
     └────────────────────────────────────────────────┘
```

This reinforces the hackathon's central theme: every specialized agent becomes more capable because they all share and continuously enrich the same persistent organizational memory. CockroachDB isn't just where data is stored—it becomes the collective memory that enables the entire multi-agent system to improve over time.

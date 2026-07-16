# Project Name

**Draftly AI**

### An Autonomous Documentation Engineering Agent with Persistent Organizational Memory

> An AI system that continuously learns from engineering conversations, support requests and GitHub activity to create, review, improve and publish documentation while remembering every decision ever made.

This is much bigger than a chatbot.

It becomes an AI documentation engineer.

---

# Vision

Imagine a company using:

- GitHub Issues
- GitHub Discussions
- Slack
- Discord
- Existing Documentation

Every day engineers answer identical questions.

The AI continuously learns from these interactions.

Instead of only answering questions...

it continuously builds documentation.

After enough confidence...

it begins maintaining the documentation automatically.

---

# What Makes This Different?

Most AI documentation tools are stateless.

Your system remembers:

- previous documentation
- why documentation changed
- reviewer feedback
- user expertise
- historical conversations
- recurring questions
- documentation quality
- approval history

That persistent memory is exactly what CockroachDB wants to showcase.

---

# High Level Architecture

```
GitHub Issues
Slack
Discord
Documentation
Release Notes
Knowledge Base

        │

AWS EventBridge / SQS

        │

────────────────────────────────────────────

           Documentation Engineer
               (Deep Agent)

        │
 ┌──────┼─────────────┬────────────┐
 ▼      ▼             ▼            ▼

Memory   GitHub     Slack      Discord
Agent    Agent      Agent       Agent

        │
        ▼

Research Agent

        │

Knowledge Synthesis Agent

        │

Documentation Writer

        │

Documentation Reviewer

        │

Human Review Agent (HITL)

        │

Publishing Agent

────────────────────────────────────────────

CockroachDB

Long-Term Memory

Vector Memory

Workflow State

Documentation Versions

Reviewer Memory

Task Memory

Agent Memory

────────────────────────────────────────────

AWS

Amazon Bedrock

Lambda

SQS

ECS

CloudWatch

S3

Secrets Manager
```

---

# Agent Architecture

Draftly is powered by a Documentation Engineer Deep Agent.

Instead of following a predefined workflow, the Deep Agent receives a high-level objective, plans the work, delegates tasks to specialized subagents, evaluates their outputs, and decides when the task is complete.

Each subagent is optimized for one responsibility while CockroachDB serves as the shared long-term memory for the entire system.

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

# CockroachDB as the Brain

This is where you score highly.

Instead of only storing vectors...

Use CockroachDB for every type of memory.

---

## Episodic Memory

Every support conversation.

```
Slack Thread

Discord Thread

GitHub Issue

Resolution

Timestamp

Participants

Outcome
```

---

## Semantic Memory

Embeddings

```
Question

Answer

Documentation

Code Examples

Tutorials
```

Use Distributed Vector Indexing.

This is one of the required technologies.

---

## Procedural Memory

Agent workflows.

```
Generate docs

Review docs

Publish docs

Notify users

```

---

## User Memory

Remember

Preferred language

Role

Team

Expertise

Past approvals

Feedback

---

## Reviewer Memory

Track

Reviewer comments

Approval patterns

Common edits

Preferred writing style

---

## Organizational Memory

Store

Best practices

Architecture decisions

Migration guides

Recurring issues

Known bugs

Release history

---

# CockroachDB Features to Use

To maximize judging points I would intentionally use **all four** CockroachDB tools.

## 1. Distributed Vector Index

Use for

Semantic retrieval

Duplicate detection

Context retrieval

Support search

Documentation search

---

## 2. MCP Server

Let the agent query memory naturally.

Example

```
Find all approved documentation about authentication.

Show unresolved recurring issues.

Find conversations similar to this thread.

Retrieve review history.
```

---

## 3. ccloud CLI

Provision

Clusters

Backups

Scaling

Monitoring

Demo

"AI creates its own development database."

That is memorable.

---

## 4. Agent Skills

Instead of writing SQL manually...

The AI uses CockroachDB Skills.

That directly aligns with the hackathon requirements.

---

# AWS Architecture

Use enough AWS services to demonstrate production readiness.

## Amazon Bedrock

Claude

Nova Pro

Llama

for reasoning

---

## Lambda

Webhook handlers

Slack

Discord

GitHub

---

## EventBridge

Schedules

Retries

Publishing

---

## SQS

Queues

Support events

---

## ECS Fargate

Runs the Documentation Engineer Deep Agent and all specialized subagents as scalable containerized services.

---

## S3

Stores

Generated docs

Images

Artifacts

Snapshots

---

## CloudWatch

Tracing

Logs

Metrics

---

## Secrets Manager

GitHub tokens

Slack tokens

Discord tokens

---

## Cognito

Reviewer authentication

---

# HITL Workflow

```
Support Question

↓

Documentation Engineer Agent

↓

Planning

↓

Delegates to Subagents

↓

Memory Retrieval

↓

Research

↓

Knowledge Synthesis

↓

Documentation Writing

↓

AI Review

↓

Confidence Check

↓

Human Review (if required)

↓

Publishing

↓

Update CockroachDB Memory
```

Rejected?

```
Feedback stored

↓

Memory updated

↓

Regenerate

↓

Review again
```

Notice:

The feedback itself becomes memory.

That is powerful.

---

# Deep Agent Execution Model

```
New Support Request

↓

Documentation Engineer Agent

↓

Goal Understanding

↓

Task Planning

↓

Delegate to Subagents

↓

Memory Agent

↓

GitHub Agent

↓

Slack Agent

↓

Discord Agent

↓

Research Agent

↓

Knowledge Synthesis

↓

Documentation Writer

↓

Documentation Reviewer

↓

Is Confidence High?

↓

Yes ───────────────► Publish

↓

No

↓

Human Review

↓

Reviewer Feedback

↓

Memory Updated

↓

Documentation Engineer decides

• Finish

• Improve

• Research More

↓

Publish

↓

Update CockroachDB Memory
```

Perfect use case for LangGraph interrupts.

---

# Database Schema

Instead of one table...

Use around 12.

```
users

organizations

projects

support_threads

support_messages

documentation

documentation_versions

embeddings

agent_memory

review_sessions

review_feedback

knowledge_entities

knowledge_relationships

tasks

audit_logs
```

---

# Make the Demo Memorable

Don't just show

"AI writes docs."

Show this:

Slack question

↓

Agent searches 200 previous conversations

↓

Finds similar GitHub Issues

↓

Finds documentation

↓

Generates tutorial

↓

Human edits

↓

AI learns from edit

↓

Publishes docs

↓

Replies to Slack

↓

Replies to Discord

↓

Future identical question answered instantly

↓

Dashboard shows memory growing

This demonstrates the evolution of organizational knowledge over time.

---

Deep Agent Features

- Dynamic task planning
- Autonomous subagent delegation
- Parallel execution of independent subagents
- Tool selection at runtime
- Automatic retry with additional context
- Shared organizational memory
- Confidence-based escalation
- Human approval checkpoints
- Persistent workflow state

---

# Production Features

These are often overlooked but align strongly with the judging criteria.

- Multi-tenant organizations
- RBAC for reviewers and admins
- Audit logs for every agent action
- Versioned documentation with rollback
- Confidence scoring before human review
- Retry queues and dead-letter queues
- Rate limiting for external APIs
- Idempotent webhook processing
- Observability with distributed tracing and metrics
- Encryption at rest and in transit
- Automated CockroachDB backups
- Disaster recovery workflow

---

# Bonus Features That Could Differentiate Your Project

A few additions could make your submission stand out on creativity and originality:

- **Knowledge Gap Detector**: analyze support traffic to identify topics that lack documentation, then proactively create a documentation backlog.
- **Documentation Freshness Agent**: monitor GitHub commits and releases, detect when documentation is outdated, and automatically open review requests.
- **Trust Score**: assign confidence scores to generated documentation based on the number of supporting sources, reviewer history, and consistency with existing docs.
- **Memory Timeline**: visualize how organizational knowledge evolves, showing which conversations led to new documentation and how reviewer feedback improved future outputs.
- **Auto-FAQ Generator**: detect recurring questions and promote them into a maintained FAQ without manual intervention.

---

# How This Maps to the Judging Criteria

| Judging Criterion            | How to Maximize Your Score                                                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Agentic Memory Design**    | Make CockroachDB the single source of truth for episodic, semantic, procedural, organizational, reviewer, and task memory. Use distributed vector indexing for semantic retrieval and transactional tables for long-term state.                              |
| **Technical Implementation** | Integrate Distributed Vector Indexing, the CockroachDB MCP Server, ccloud CLI, and Agent Skills. Combine them with a LangChain Deep Agent architecture, autonomous subagent delegation, CockroachDB-backed persistent memory, and AWS-native infrastructure. |
| **Real-World Impact**        | Position the project as an autonomous documentation engineering platform that reduces support load, preserves institutional knowledge, and continuously improves documentation quality.                                                                      |
| **Production Readiness**     | Demonstrate secure authentication, RBAC, audit logging, observability, retries, backups, versioning, scalable event processing, and human-in-the-loop approvals.                                                                                             |
| **Creativity & Originality** | Focus on the idea of an AI that doesn't just answer questions but continuously builds, maintains, and learns from an organization's documentation over time, turning support conversations into durable institutional memory.                                |

This approach transforms your original idea into a showcase of **persistent agentic memory**, where CockroachDB is not simply a database but the long-term memory system that enables autonomous documentation engineering. That emphasis aligns directly with the hackathon's focus on production-grade memory, meaningful use of CockroachDB tools, AWS deployment, and real-world impact.

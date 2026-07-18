# Product Requirements Document

## Project Scope

Draftly is an autonomous documentation engineering platform that transforms support conversations into production-ready documentation using AI agents, CockroachDB, and AWS.

## MVP Features

### Core Pipeline
- LangGraph 8-node state machine with Human-in-the-Loop (HITL) interrupts
- Automated ingestion from Slack, Discord, and GitHub
- Semantic search across documentation and support threads
- Versioned documentation with confidence scoring

### Memory System
- **Episodic Memory**: Support thread history and context
- **Procedural Memory**: Agent workflow states and decisions
- **Organizational Memory**: Team knowledge and patterns
- **Reviewer Memory**: Human feedback and approval history
- **Semantic Memory**: Vector embeddings for similarity search

### Integrations
- Slack bot for support thread ingestion
- Discord bot for community support
- GitHub integration for issues and documentation
- Requesty/OpenAI API for LLM reasoning

### Review Dashboard
- Web-based interface for human review
- Document preview with confidence scores
- Approve/Reject/Revise workflow

## Technical Requirements

### Stack
- Python 3.11+ with FastAPI
- LangGraph for agent orchestration
- CockroachDB with distributed vector index
- Requesty/OpenAI-compatible API for LLM
- AWS (ECS Fargate, ECR, CloudWatch)

### Infrastructure
- Containerized deployment (Docker)
- CI/CD with GitHub Actions
- Multi-environment support (staging, production)
- Scalable with AWS Fargate

## Success Metrics

| Metric | Target |
|--------|--------|
| Documentation accuracy score | >= 0.8 |
| Time to generate docs | < 5 minutes |
| Human review approval rate | >= 90% |
| Support thread coverage | >= 80% |
| Agent workflow completion rate | >= 95% |

## Out of Scope

- Real-time streaming documentation
- Multi-language support (v2)
- Custom LLM training
- Mobile application

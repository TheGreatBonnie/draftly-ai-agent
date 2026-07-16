# **CockroachDB × AWS Hackathon - Build with Agentic Memory**

## **The Challenge**

**Build an agentic application that uses CockroachDB as its persistent memory layer, deployed on AWS.**

Your agent should store, retrieve, and act on memory whether that's conversation history, user context, task state, embeddings, or structured transactional data. The best submissions will demonstrate that memory is not an afterthought, it is the thing that makes an agent useful in production.

All submissions must use at least two of the following CockroachDB tools:

- **CockroachDB Cloud Managed MCP Server** — Connect AI agents directly to CockroachDB clusters with a single config snippet from the Cloud Console. Works natively with Claude Code, Cursor, and VS Code. Safe by default: read-only mode, full audit logging, zero custom proxy required. Endpoint: https://cockroachlabs.cloud/mcp
- **CockroachDB Distributed Vector Indexing** — Store and query embeddings at scale using CockroachDB's vector support with distributed indexing. Semantic search and retrieval stay fast as your data grows — no separate vector store to maintain, no reindexing pain, and no consistency gaps between your vector data and your operational database. Ideal for RAG pipelines, long-term agent memory, and semantic search applications.
- **ccloud CLI (Agent-Ready)** — Give your agent direct, secure access to the full CockroachDB Cloud control plane. Provision clusters, manage backups, configure networking, monitor audit logs — all from the terminal. Designed for AI with consistent noun-verb patterns, JSON output on every command, and granular service-account-based RBAC.
- **CockroachDB Agent Skills Repo (Open Source)** — A curated, open-source collection of machine-executable Agent Skills encoding CockroachDB expertise. Skills span onboarding, query/schema design, operations, performance, security, and observability. Portable across Claude, Cursor, LangChain, and any MCP-compatible client.

All submissions must also use at least one AWS service:

- Amazon Bedrock (foundation models, knowledge bases, or agents)
- AWS Lambda (serverless agent execution)
- Amazon ECS / EKS (containerized agent workloads)
- Amazon S3 (artifact or document storage)
- Amazon SageMaker (model training or inference)
- Amazon Bedrock Agents (multi-step agentic workflows)
- Any other AWS service that powers your agent's environment

#### **What to Submit**

- Provide a URL to your public open source code repository for judging and testing.
  - The repository must contain all necessary source code, clear README documentation, any required dependencies, example configurations or datasets if applicable, and setup and run instructions required for the project to be functional.
  - The repository must be public and open source by including an open source license file (we recommend MIT or Apache 2.0). This license should be detectable and visible at the top of the repository page (in the About section).
- Provide a URL to your functional demo app.
- Include a video (less than 3 minutes) that demonstrates your submission and the CockroachDB memory layer at work. Videos must be uploaded to YouTube or Vimeo and made public.
- Identify which CockroachDB tools you used (MCP Server, ccloud CLI, Distributed Vector Indexing, Agent Skills) and how — what did the agent actually do with them?
- Identify which AWS Services tools you used (Amazon Bedrock, AWS Lambda, Amazon S3, etc.) and how.
- Optional: Include an architectural diagram showing how CockroachDB, AWS services, and your agent interact.
- Optional: Provide feedback on the CockroachDB AI tools or features.

---

## Hackathon Project

Build an AI agent that pulls context from GitHub issues, slack and discord support channels to generate draft docs, tutorials and how-to guides.

The agent should implement HITL to allow human reviewers to verify output.

Once reviewed and verified, the agent replies to the support queries on Slack and Discord.

## Judging Criteria

1. **Agentic Memory Design**: Does CockroachDB play a meaningful, production-grade role as the agent's memory layer? Is it used for more than toy queries — state, embeddings, context, or transactional data at real scale?

2. **Technical Implementation**: Is the integration with CockroachDB tools (distributed vector index, MCP Server, ccloud CLI) quality software engineering? Does the agent use the tools correctly and safely?

3. **Real-World Impact**: How big of an impact could the project have on real users or workflows? Is the use case meaningful, not just technically impressive?

4. **Production Readiness**: Is the design secure, observable, and scalable? Has the team thought about resilience, access control, and what happens when things go wrong?

5. **Creativity & Originality**: Is this a genuinely new idea or a novel application of the technology? Does it demonstrate insight into what makes agentic systems different from traditional apps?

# Sample GitHub Issues — RAG Docs Pipeline Testing

These issues reference the Deep Agents RAG tutorial at
https://docs.langchain.com/oss/python/deepagents/rag and vary in
complexity to exercise different parts of the pipeline.

---

## Issue 1 — Simple howto (single question, clear answer in docs)

**Title:** How do I index LangChain docs into a vector store for RAG?

**Body:**

I'm following the Deep Agents RAG tutorial at https://docs.langchain.com/oss/python/deepagents/rag and want to index our internal documentation. The tutorial shows loading docs with `requests` and splitting with `RecursiveCharacterTextSplitter`, but I'm not sure what chunk_size and overlap values work best for documentation pages. What's the recommended setup?

---

## Issue 2 — Multi-step investigation (requires research + code examples)

**Title:** How do I set up the search_documentation tool with filesystem offloading?

**Body:**

Working through the RAG tutorial (https://docs.langchain.com/oss/python/deepagents/rag). I have the vector store indexed but I'm stuck on building the `search_documentation` tool. The tutorial mentions `backend.upload_files()` and writing chunks to `/retrieved/{batch_id}/`, but I can't find how to initialize the `StateBackend` and wire it into `create_deep_agent`. Can someone walk through the full setup including the backend configuration?

---

## Issue 3 — Troubleshooting (error-oriented, needs diagnosis)

**Title:** RAG agent returns generic answers even after indexing docs

**Body:**

I followed the full tutorial at https://docs.langchain.com/oss/python/deepagents/rag — indexed 14 LangChain docs, built the search tool, set up the chunk-analyst subagent. But when I ask questions like "How do I stream intermediate tool results from a subagent?", the agent responds with generic advice instead of citing the docs I indexed.

Trace from LangSmith shows `search_documentation` is called and returns 4 chunks, but the final answer doesn't reference them. Is there a prompt configuration issue or is the `SUBAGENT_DELEGATION_INSTRUCTIONS` not being passed correctly?

---

## Issue 4 — Conceptual question (requires synthesis across multiple sections)

**Title:** When should I use the "retrieve, offload, and delegate" pattern vs skills-guided retrieval?

**Body:**

The RAG patterns page (https://docs.langchain.com/oss/python/deepagents/rag) describes four patterns: skills-guided retrieval, rubric-checked grounding, todo-driven investigation, and retrieve/offload/delegate.

For a documentation Q&A bot with ~500 pages of internal docs and ~200 queries/day, which pattern makes sense? I'm specifically concerned about latency — the offload pattern seems like it adds overhead with filesystem writes and subagent delegation. Is there a benchmark or decision framework?

---

## Issue 5 — Integration question (cross-references multiple docs)

**Title:** Can I combine the RAG tutorial with grading rubrics for production use?

**Body:**

The Deep Agents RAG tutorial (https://docs.langchain.com/oss/python/deepagents/rag) says grading rubrics are in beta and require `deepagents>=0.6.5`. I want to deploy the RAG agent in production with rubric-checked grounding to ensure answers are actually grounded in our docs.

Two questions:
1. Is `RubricMiddleware` stable enough for production, or should I wait?
2. The tutorial only shows the "retrieve, offload, delegate" pattern — how do I add rubric grading on top of that? Is it a middleware on the agent or on the subagent?

---

## Issue 6 — Edge case / advanced (tests deep agent pipeline logic)

**Title:** How do I handle large doc pages that exceed chunk limits in the RAG pipeline?

**Body:**

Some of our internal docs are 50k+ tokens (full API reference pages). The RAG tutorial (https://docs.langchain.com/oss/python/deepagents/rag) uses `chunk_size=1000` with `chunk_overlap=200`. For a 50k token page, that's ~50 chunks from a single document.

The tutorial says the agent can "paginate through files with built-in search tools" for large documents, but doesn't show how. Questions:
1. Should I increase chunk_size for large pages or keep it small?
2. How does `search_documentation` handle returning 50+ chunks — does it batch them?
3. Is there a max number of parallel `task()` calls the chunk-analyst subagent can handle?

---

## Issue 7 — Very short question (tests minimal context)

**Title:** What chunk size should I use?

**Body:**

What's a good chunk_size for RAG?

---

## Issue 8 — Verbose multi-part question (tests complex decomposition)

**Title:** Full deployment guide: RAG agent with auth, rate limiting, caching, and monitoring

**Body:**

I need to deploy the Deep Agents RAG agent (https://docs.langchain.com/oss/python/deepagents/rag) to production for our team of 50 engineers. Here are my requirements:

1. **Authentication:** Only engineers in our Okta group should be able to query the agent. The tutorial doesn't mention auth at all — how do I add API key or OAuth auth on top of the agent endpoint?

2. **Rate limiting:** We need per-user rate limits (100 queries/hour) to prevent abuse. Should I implement this at the FastAPI layer, in a LangGraph middleware, or via a reverse proxy?

3. **Caching:** Many engineers ask the same questions about our internal APIs. The tutorial mentions "context caching" but doesn't show how to cache at the retrieval layer vs the LLM response layer. Which approach saves more tokens?

4. **Monitoring:** We use Datadog for observability. The tutorial mentions LangSmith for tracing, but I need metrics like p50/p95 latency, cache hit rate, and chunk retrieval accuracy. Is there a way to export these from the agent?

5. **Cost management:** At ~200 queries/day with ~500 indexed docs, what's the expected monthly token cost? The tutorial uses `deepseek-v4-flash` — is that the cheapest option that still passes rubric grading?

Please provide a step-by-step deployment guide covering all five areas.

---

## Issue 9 — Ambiguous question (tests clarification and interpretation)

**Title:** It's not working

**Body:**

I followed the tutorial at https://docs.langchain.com/oss/python/deepagents/rag and the search tool doesn't find anything. I indexed the docs and everything. What am I doing wrong?

---

## Issue 10 — Comparison question (requires synthesis across multiple docs)

**Title:** LangChain vs LlamaIndex vs Deep Agents for internal documentation RAG

**Body:**

We're building an internal documentation Q&A system for ~2000 pages of engineering docs. I've been evaluating three approaches:

1. **LangChain** with RetrievalQA chain
2. **LlamaIndex** with its default retriever
3. **Deep Agents RAG** tutorial pattern (https://docs.langchain.com/oss/python/deepagents/rag)

Key requirements:
- Answers must be grounded in our docs (no hallucination)
- Must handle questions that span multiple documents
- Need sub-3-second response times for 90% of queries
- Team of 3 engineers to maintain

I've read that Deep Agents uses "rubric-checked grounding" which sounds like it directly addresses requirement #1. But I'm not sure how it compares on requirements #2-4. Can someone break down the trade-offs?

---

## Issue 11 — Code-heavy question (tests code example generation)

**Title:** Custom chunking strategy for API reference docs with cross-references

**Body:**

Our API reference docs have a specific structure: each endpoint has a URL path, HTTP method, parameters table, response schema, and code examples in multiple languages. The standard `RecursiveCharacterTextSplitter` with `chunk_size=1000` breaks these apart arbitrarily — a parameter list ends up in a different chunk than its endpoint definition.

Following the RAG tutorial at https://docs.langchain.com/oss/python/deepagents/rag, I want to implement a custom `chunk_document()` function that:

1. Splits on endpoint boundaries (each endpoint = one chunk)
2. If an endpoint exceeds 2000 tokens, splits into logical subsections (params, response, examples) with overlap
3. Preserves markdown table formatting in the chunk metadata
4. Adds cross-reference links as chunk metadata so the agent can chain related endpoints

Can someone provide a working implementation? The tutorial only shows `RecursiveCharacterTextSplitter` and I need something smarter for API docs.

---

## Issue 12 — Migration / upgrade question (tests version compatibility)

**Title:** Upgrading from deepagents 0.5.x to 0.6.x — what breaks?

**Body:**

We have a production RAG agent built on `deepagents==0.5.3` using the pattern from https://docs.langchain.com/oss/python/deepagents/rag. The tutorial now references `deepagents>=0.6.5` for rubric grading and mentions breaking changes in the `StateBackend` API.

Questions:
1. What specific breaking changes exist between 0.5.x and 0.6.x?
2. The tutorial's `backend.upload_files()` API changed — is there a migration guide?
3. Our existing rubric configs use `RubricConfig(version="1.0")` — do they need updating for 0.6.x?
4. Can we run 0.5.x and 0.6.x side by side during migration?

We can't afford downtime, so I need to understand the full scope before upgrading.

---

## Issue 13 — Opinion / recommendation question (tests balanced analysis)

**Title:** Should I use the todo-driven investigation pattern for our support bot?

**Body:**

We're building a support bot that handles tickets about our platform. The RAG tutorial (https://docs.langchain.com/oss/python/deepagents/rag) describes a "todo-driven investigation" pattern where the agent creates a todo list and investigates each item sequentially.

For support tickets that typically involve:
- Checking user account status
- Reviewing recent deployment logs
- Looking up known issues in our status page
- Cross-referencing with past similar tickets

Does the todo-driven pattern make sense? Or is the simpler "retrieve, offload, delegate" pattern sufficient? I'm worried about over-engineering — the todo pattern seems like it adds latency for straightforward questions.

---

## Issue 14 — Configuration / environment question (tests infra knowledge)

**Title:** What vector store does the RAG tutorial actually use, and can I swap it?

**Body:**

The Deep Agents RAG tutorial at https://docs.langchain.com/oss/python/deepagents/rag loads docs into a vector store but I can't tell which one it uses by default. The code samples show `vector_store.add_documents()` but don't import a specific vector store class.

Questions:
1. What's the default vector store? In-memory? Chroma? Something else?
2. Can I swap it for Pinecone or Weaviate? The tutorial doesn't mention the interface.
3. Our docs are ~5GB of markdown — will the default store handle that?
4. Is there a `VectorStoreConfig` I need to set?

---

## Issue 15 — Performance / scaling question (tests quantitative reasoning)

**Title:** Latency benchmarks for the RAG agent at scale

**Body:**

We're evaluating the Deep Agents RAG agent (https://docs.langchain.com/oss/python/deepagents/rag) for a high-throughput use case: ~1000 queries/day across 5000 indexed documents.

The tutorial doesn't include any performance benchmarks. I need to know:
1. What's the p50/p95/p99 latency for a typical query?
2. How does latency scale with the number of indexed documents? Is it O(1) (vector lookup) or O(n)?
3. The chunk-analyst subagent adds a delegation step — what's the overhead compared to direct retrieval?
4. If I use `deepseek-v4-flash` vs a slower model like `gpt-4o`, how much does that affect end-to-end latency?
5. Are there any known bottlenecks in the `search_documentation` tool when returning 20+ chunks?

We need sub-5-second responses for 95% of queries. Is this realistic?

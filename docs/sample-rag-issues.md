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

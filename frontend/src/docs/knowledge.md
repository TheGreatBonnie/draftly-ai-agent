# Using the Knowledge Base

The Knowledge Base is Draftly's memory of your organization's documentation. It provides context for the AI pipeline — the richer your knowledge base, the better the generated documentation.

## What the Knowledge Base Does

When Draftly generates documentation, it searches the knowledge base for relevant context using semantic vector search (3072-dimension embeddings). This means:

- Generated docs reference your existing terminology and patterns
- New documentation is consistent with what you've already published
- The AI can build on previous documentation rather than starting from scratch

## Adding Content

### URL Import

Import content from external sources:

1. Go to **Knowledge Base** in the sidebar
2. Click **Import from URL**
3. Paste a URL pointing to one of:
   - Web pages (HTML)
   - PDF documents
   - Google Docs (public or shared)
   - Notion pages (public)
4. Click **Fetch** — Draftly retrieves and parses the content
5. Review the preview, then click **Import** to add it

### Manual Document Ingest

Add content directly:

1. Go to **Knowledge Base** in the sidebar
2. Fill in the manual ingest form:
   - **Title** — A clear name for the document
   - **Doc Type** — Select from: howto, faq, tutorial, troubleshooting, reference
   - **Content** — Paste the full text content
3. Click **Ingest** to add it to the knowledge base

### Doc Types

Choosing the right doc type helps Draftly categorize and retrieve content:

| Type | Use For |
|------|---------|
| `howto` | Step-by-step instructions |
| `faq` | Frequently asked questions and answers |
| `tutorial` | Learning-oriented guides |
| `troubleshooting` | Problem-solving and debugging |
| `reference` | Technical specifications and API docs |

## Managing Documents

The Knowledge Base page lists all imported documents:

- **Expand/Collapse** — Click to view full document content
- **Status Badge** — Shows document processing status
- **Delete** — Remove documents that are no longer relevant

### Document Processing

After ingestion, documents go through:

1. **Chunking** — Split into 1000-character chunks with 200-character overlap
2. **Embedding** — Each chunk is converted to a 3072-dimension vector
3. **Storage** — Vectors are stored in CockroachDB with metadata
4. **Indexing** — A C-SPANN vector index enables fast similarity search

This process happens automatically in the background.

## How Knowledge Affects Documentation Quality

The knowledge base directly impacts generated documentation:

- **More context = better docs** — The AI has more reference material to draw from
- **Consistent terminology** — Generated docs use your team's language and conventions
- **Reduced hallucination** — The AI grounds its output in real documentation
- **Faster generation** — Less research needed when context is readily available

### Tips for a Strong Knowledge Base

1. **Import existing docs first** — Start with your current documentation, wikis, and runbooks
2. **Cover common topics** — Ensure FAQs, howtos, and troubleshooting guides are included
3. **Keep it updated** — Remove outdated documents and add new ones regularly
4. **Use the right doc types** — Accurate categorization improves retrieval quality
5. **Include API references** — Technical documentation helps with configuration and troubleshooting topics

## Semantic Search

The **Memory** page provides semantic search across your knowledge base:

1. Enter a search query in natural language
2. Draftly finds the most semantically similar content
3. Results show content type, similarity score, and text snippet
4. Use this to verify what context the AI pipeline has access to

## Memory System

Draftly's memory system has five layers:

| Memory Type | What It Stores |
|-------------|----------------|
| Episodic | Support thread history and context |
| Procedural | Agent workflow states and decisions |
| Organizational | Team knowledge and patterns |
| Reviewer | Human feedback and approval history |
| Semantic | Vector embeddings for similarity search |

The knowledge base feeds into **Organizational** and **Semantic** memory, making it the foundation for documentation quality.

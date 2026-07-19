from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.templating import Jinja2Templates

from src.api.routes import docs, github, memory, review, reviewers, reviews
from src.database import close_pool, get_pool

templates = Jinja2Templates(directory="src/api/templates")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(title="Draftly Review Dashboard", lifespan=lifespan)

app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(reviewers.router, prefix="/api/reviewers", tags=["reviewers"])
app.include_router(review.router, prefix="/api/review", tags=["review"])
app.include_router(docs.router, prefix="/api/docs", tags=["docs"])
app.include_router(memory.router, prefix="/api/memory", tags=["memory"])
app.include_router(github.router, prefix="/api/github", tags=["github"])


@app.get("/")
async def dashboard():
    from src.memory.reviewer import get_pending_reviews

    reviews = await get_pending_reviews(org_id="default")
    return templates.TemplateResponse("dashboard.html", {"request": {}, "reviews": reviews})


@app.get("/review/{review_id}")
async def review_page(review_id: str):
    from src.database import fetch_one

    review = await fetch_one(
        "SELECT rs.*, rs.id::text as id, d.title, d.content, d.doc_type, d.confidence_score "
        "FROM review_sessions rs JOIN documentation d ON d.id = rs.doc_id WHERE rs.id = $1",
        review_id,
    )
    review_data = dict(review) if review else None
    return templates.TemplateResponse("review.html", {"request": {}, "review": review_data})

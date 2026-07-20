from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.api.routes import clerk, docs, github, memory, review, reviewers, reviews, slack
from src.database import close_pool, get_pool


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
app.include_router(clerk.router, prefix="/api/clerk", tags=["clerk"])
app.include_router(slack.router, prefix="/api/slack", tags=["slack"])

DIST_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        file_path = DIST_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(DIST_DIR / "index.html")

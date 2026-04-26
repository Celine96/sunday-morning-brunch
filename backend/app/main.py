"""Main FastAPI application."""
import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import shop, agent

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="리뷰 대댓글 생성 에이전트 API",
    description="Sunday Morning Brunch - 리뷰 대댓글 자동 생성 에이전트",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ] + [
        origin for origin in [os.environ.get("FRONTEND_URL", "")]
        if origin
    ] + [
        f"https://{host}" for host in [os.environ.get("RENDER_EXTERNAL_HOSTNAME", "")]
        if host
    ],
    allow_origin_regex=r"https://(smb-web|sub-api-qq2o)\.onrender\.com",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Include routers
app.include_router(shop.router)
app.include_router(agent.router)


@app.get("/")
def root():
    return {"message": "리뷰 대댓글 생성 에이전트 API", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}

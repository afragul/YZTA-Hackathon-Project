import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.middleware import SecurityHeadersMiddleware
from app.db.init_db import init_db
from app.db.session import database
from app.services.storage_service import get_storage


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logging.getLogger("passlib").setLevel(logging.ERROR)
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting %s in %s mode", settings.PROJECT_NAME, settings.ENVIRONMENT)
    await init_db()
    try:
        get_storage().ensure_bucket()
    except Exception as exc:
        logger.warning("MinIO bucket init failed: %s", exc)
    yield
    await database.dispose()
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="0.1.0",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/health", tags=["health"], status_code=status.HTTP_200_OK)
    async def health() -> JSONResponse:
        return JSONResponse({"status": "ok", "environment": settings.ENVIRONMENT})

    return app


app = create_app()

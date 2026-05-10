import asyncio
import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import database
from app.models.user import UserRole
from app.services.user_service import UserService


logger = logging.getLogger(__name__)


def _alembic_config() -> Config:
    backend_root = Path(__file__).resolve().parents[2]
    config = Config(str(backend_root / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "alembic"))
    config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    return config


def _alembic_upgrade_head() -> None:
    command.upgrade(_alembic_config(), "head")


def _alembic_stamp_initial() -> None:
    command.stamp(_alembic_config(), "0001_initial")


async def _legacy_stamp_if_needed() -> None:
    """
    If the DB already has a `users` table but no `alembic_version`
    (legacy `Base.metadata.create_all` deployment), stamp it as initial
    and add any columns that the legacy schema may be missing.
    """
    async with database.engine.begin() as conn:
        def _inspect(sync_conn) -> tuple[bool, bool]:
            inspector = inspect(sync_conn)
            return inspector.has_table("users"), inspector.has_table("alembic_version")

        has_users, has_alembic = await conn.run_sync(_inspect)
        if has_users and not has_alembic:
            logger.warning(
                "Legacy DB detected (users without alembic_version). "
                "Stamping as 0001_initial."
            )
            await conn.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS avatar_key VARCHAR(512) NULL"
                )
            )
            await asyncio.to_thread(_alembic_stamp_initial)


async def run_migrations() -> None:
    await _legacy_stamp_if_needed()
    await asyncio.to_thread(_alembic_upgrade_head)


async def seed_users(session: AsyncSession) -> None:
    service = UserService(session)

    if await service.get_by_username(settings.FIRST_ADMIN_USERNAME) is None:
        await service.create(
            username=settings.FIRST_ADMIN_USERNAME,
            email=settings.FIRST_ADMIN_EMAIL,
            password=settings.FIRST_ADMIN_PASSWORD,
            role=UserRole.ADMIN,
            full_name="YZTA Admin",
        )
        logger.info("Seeded admin user: %s", settings.FIRST_ADMIN_USERNAME)

    if await service.get_by_username(settings.FIRST_USER_USERNAME) is None:
        await service.create(
            username=settings.FIRST_USER_USERNAME,
            email=settings.FIRST_USER_EMAIL,
            password=settings.FIRST_USER_PASSWORD,
            role=UserRole.USER,
            full_name="YZTA User",
        )
        logger.info("Seeded user: %s", settings.FIRST_USER_USERNAME)


async def init_db() -> None:
    """
    Legacy entry point kept for backward compatibility.

    Production / docker setups should call `python -m app.db.bootstrap`
    via the entrypoint script BEFORE starting uvicorn (avoids race
    conditions with --reload).
    """
    await run_migrations()
    async with database.session_factory() as session:
        await seed_users(session)

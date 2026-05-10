"""
Database bootstrap — runs migrations and seeds.

Designed to be invoked once at container startup, BEFORE uvicorn starts.
This avoids race conditions caused by uvicorn's --reload spawning multiple
processes that all try to migrate at the same time.

Usage:
    python -m app.db.bootstrap
"""

import asyncio
import logging

from app.db.init_db import run_migrations, seed_users
from app.db.seeder import seed_all
from app.db.session import database


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("bootstrap")


async def main() -> None:
    logger.info("Bootstrap: running migrations…")
    await run_migrations()

    logger.info("Bootstrap: seeding admin users…")
    async with database.session_factory() as session:
        await seed_users(session)

    logger.info("Bootstrap: seeding demo data…")
    async with database.session_factory() as session:
        await seed_all(session)

    await database.dispose()
    logger.info("Bootstrap: done.")


if __name__ == "__main__":
    asyncio.run(main())

from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.token_blocklist import TokenBlocklist


class TokenBlocklistService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def is_revoked(self, jti: str) -> bool:
        result = await self.session.execute(
            select(TokenBlocklist.id).where(TokenBlocklist.jti == jti)
        )
        return result.scalar_one_or_none() is not None

    async def revoke(self, jti: str, user_id: int, expires_at: datetime) -> None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        entry = TokenBlocklist(jti=jti, user_id=user_id, expires_at=expires_at)
        self.session.add(entry)
        try:
            await self.session.commit()
        except IntegrityError:
            # Already revoked — idempotent.
            await self.session.rollback()

    async def purge_expired(self) -> int:
        now = datetime.now(timezone.utc)
        result = await self.session.execute(
            delete(TokenBlocklist).where(TokenBlocklist.expires_at < now)
        )
        await self.session.commit()
        return result.rowcount or 0

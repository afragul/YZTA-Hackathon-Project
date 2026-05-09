from datetime import datetime
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TokenBlocklist(Base):
    """
    Stores revoked JWT IDs (`jti`) so refresh/access tokens can be invalidated
    on logout. Rows past `expires_at` are eligible for periodic cleanup.
    """

    __tablename__ = "token_blocklist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    jti: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )

    def __repr__(self) -> str:
        return f"<TokenBlocklist jti={self.jti[:8]}... user_id={self.user_id}>"

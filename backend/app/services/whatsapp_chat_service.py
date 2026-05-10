"""
WhatsApp chat persistence + Cloud API send/receive.

Responsibilities
----------------
- List / fetch conversations and messages for the panel.
- Send outbound messages through the Meta Graph `messages` endpoint and
  persist them with the returned `wamid`.
- Process inbound webhook payloads, deduplicate by `wamid`, upsert the
  conversation row, persist the message, and bump unread counters.

The hackathon scope assumes a single active WhatsApp account row, but
the schema is multi-account ready (every conversation/message is keyed
by `account_id`).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.secrets import decrypt_secret
from app.models.whatsapp_account import WhatsAppAccount, WhatsAppAccountStatus
from app.models.whatsapp_chat import (
    ConversationStatus,
    MessageDirection,
    MessageKind,
    MessageStatus,
    WhatsAppChatMessage,
    WhatsAppConversation,
)
from app.schemas.whatsapp_chat import (
    WhatsAppConversationStats,
)


logger = logging.getLogger("app.whatsapp.chat")


_KIND_FROM_TYPE: dict[str, MessageKind] = {
    "text": MessageKind.TEXT,
    "image": MessageKind.IMAGE,
    "video": MessageKind.VIDEO,
    "audio": MessageKind.AUDIO,
    "document": MessageKind.DOCUMENT,
    "sticker": MessageKind.STICKER,
    "location": MessageKind.LOCATION,
    "contacts": MessageKind.CONTACTS,
    "interactive": MessageKind.INTERACTIVE,
    "button": MessageKind.BUTTON,
    "reaction": MessageKind.REACTION,
    "system": MessageKind.SYSTEM,
}


def _graph_url(api_version: str, path: str) -> str:
    base = settings.WHATSAPP_GRAPH_BASE_URL.rstrip("/")
    return f"{base}/{api_version}/{path.lstrip('/')}"


def _norm_wa_id(wa_id: str) -> str:
    """Meta returns the wa_id without leading '+'; we follow suit."""
    cleaned = "".join(c for c in wa_id if c.isdigit())
    return cleaned


class WhatsAppChatService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ─────────────────────────────────────────────────────── account util

    async def _get_active_account(self) -> WhatsAppAccount:
        result = await self.session.execute(
            select(WhatsAppAccount)
            .where(WhatsAppAccount.status != WhatsAppAccountStatus.DISCONNECTED)
            .order_by(WhatsAppAccount.created_at.desc())
            .limit(1)
        )
        account = result.scalar_one_or_none()
        if account is None:
            raise HTTPException(
                status_code=status.HTTP_412_PRECONDITION_FAILED,
                detail=(
                    "WhatsApp hesabı bağlı değil. Lütfen önce Ayarlar → "
                    "Entegrasyonlar üzerinden WhatsApp Business hesabını bağlayın."
                ),
            )
        return account

    async def _get_account_by_phone_number_id(
        self, phone_number_id: str
    ) -> WhatsAppAccount | None:
        result = await self.session.execute(
            select(WhatsAppAccount).where(
                WhatsAppAccount.phone_number_id == phone_number_id
            )
        )
        return result.scalar_one_or_none()

    # ───────────────────────────────────────────────────────── conversations

    async def list_conversations(
        self,
        *,
        account_id: int,
        status_filter: ConversationStatus | None = None,
        search: str | None = None,
        page: int = 1,
        limit: int = 50,
    ) -> tuple[list[WhatsAppConversation], int]:
        page = max(1, page)
        limit = max(1, min(200, limit))

        base = select(WhatsAppConversation).where(
            WhatsAppConversation.account_id == account_id
        )

        if status_filter is not None:
            base = base.where(WhatsAppConversation.status == status_filter)

        if search:
            ilike = f"%{search.strip()}%"
            base = base.where(
                (WhatsAppConversation.contact_name.ilike(ilike))
                | (WhatsAppConversation.wa_id.ilike(ilike))
                | (WhatsAppConversation.last_message_text.ilike(ilike))
            )

        total_result = await self.session.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = int(total_result.scalar_one())

        rows_result = await self.session.execute(
            base.order_by(
                desc(WhatsAppConversation.is_pinned),
                desc(WhatsAppConversation.last_message_at),
                desc(WhatsAppConversation.created_at),
            )
            .offset((page - 1) * limit)
            .limit(limit)
        )
        rows = list(rows_result.scalars().unique().all())
        return rows, total

    async def get_conversation(
        self, *, account_id: int, conversation_id: int
    ) -> WhatsAppConversation:
        result = await self.session.execute(
            select(WhatsAppConversation).where(
                WhatsAppConversation.id == conversation_id,
                WhatsAppConversation.account_id == account_id,
            )
        )
        conv = result.scalar_one_or_none()
        if conv is None:
            raise HTTPException(
                status_code=404, detail="Konuşma bulunamadı."
            )
        return conv

    async def get_or_create_conversation(
        self,
        *,
        account: WhatsAppAccount,
        wa_id: str,
        contact_name: str | None = None,
        contact_profile_pic_url: str | None = None,
    ) -> WhatsAppConversation:
        normalized = _norm_wa_id(wa_id)
        result = await self.session.execute(
            select(WhatsAppConversation).where(
                WhatsAppConversation.account_id == account.id,
                WhatsAppConversation.wa_id == normalized,
            )
        )
        conv = result.scalar_one_or_none()
        if conv:
            updated = False
            if contact_name and conv.contact_name != contact_name:
                conv.contact_name = contact_name
                updated = True
            if (
                contact_profile_pic_url
                and conv.contact_profile_pic_url != contact_profile_pic_url
            ):
                conv.contact_profile_pic_url = contact_profile_pic_url
                updated = True
            if updated:
                self.session.add(conv)
                await self.session.commit()
                await self.session.refresh(conv)
            return conv

        conv = WhatsAppConversation(
            account_id=account.id,
            wa_id=normalized,
            contact_name=contact_name,
            contact_profile_pic_url=contact_profile_pic_url,
            status=ConversationStatus.OPEN,
        )
        self.session.add(conv)
        await self.session.commit()
        await self.session.refresh(conv)
        logger.info(
            "Created conversation account=%s wa_id=%s id=%s",
            account.id,
            normalized,
            conv.id,
        )
        return conv

    async def update_conversation_status(
        self,
        *,
        account_id: int,
        conversation_id: int,
        new_status: ConversationStatus,
    ) -> WhatsAppConversation:
        conv = await self.get_conversation(
            account_id=account_id, conversation_id=conversation_id
        )
        conv.status = new_status
        self.session.add(conv)
        await self.session.commit()
        await self.session.refresh(conv)
        return conv

    async def mark_read(
        self, *, account_id: int, conversation_id: int
    ) -> WhatsAppConversation:
        conv = await self.get_conversation(
            account_id=account_id, conversation_id=conversation_id
        )
        if conv.unread_count != 0:
            conv.unread_count = 0
            self.session.add(conv)
            await self.session.commit()
            await self.session.refresh(conv)
        return conv

    async def get_stats(self, *, account_id: int) -> WhatsAppConversationStats:
        rows = await self.session.execute(
            select(
                WhatsAppConversation.status,
                func.count(WhatsAppConversation.id),
                func.coalesce(func.sum(WhatsAppConversation.unread_count), 0),
            )
            .where(WhatsAppConversation.account_id == account_id)
            .group_by(WhatsAppConversation.status)
        )
        stats = WhatsAppConversationStats(
            total=0, open=0, pending=0, closed=0, unread=0
        )
        for status_value, count, unread in rows.all():
            stats.total += int(count)
            stats.unread += int(unread or 0)
            key = (
                status_value.value
                if hasattr(status_value, "value")
                else str(status_value)
            )
            if key == ConversationStatus.OPEN.value:
                stats.open = int(count)
            elif key == ConversationStatus.PENDING.value:
                stats.pending = int(count)
            elif key == ConversationStatus.CLOSED.value:
                stats.closed = int(count)
        return stats

    # ─────────────────────────────────────────────────────────── messages

    async def list_messages(
        self,
        *,
        account_id: int,
        conversation_id: int,
        page: int = 1,
        limit: int = 50,
    ) -> tuple[list[WhatsAppChatMessage], int]:
        # Confirms ownership.
        await self.get_conversation(
            account_id=account_id, conversation_id=conversation_id
        )

        page = max(1, page)
        limit = max(1, min(200, limit))

        total_result = await self.session.execute(
            select(func.count(WhatsAppChatMessage.id)).where(
                WhatsAppChatMessage.conversation_id == conversation_id
            )
        )
        total = int(total_result.scalar_one())

        rows_result = await self.session.execute(
            select(WhatsAppChatMessage)
            .where(WhatsAppChatMessage.conversation_id == conversation_id)
            .order_by(WhatsAppChatMessage.created_at.asc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        rows = list(rows_result.scalars().unique().all())
        return rows, total

    # ────────────────────────────────────────────────────────── send text

    async def _decrypt_token(self, account: WhatsAppAccount) -> str:
        try:
            return decrypt_secret(account.access_token_ciphertext)
        except ValueError as exc:
            raise HTTPException(
                status_code=500,
                detail="Saklanmış token çözülemedi. Yeniden bağlayın.",
            ) from exc

    async def send_text(
        self,
        *,
        account_id: int,
        conversation_id: int,
        body: str,
        sent_by_user_id: int | None,
    ) -> WhatsAppChatMessage:
        account = await self._get_active_account()
        if account.id != account_id:
            raise HTTPException(
                status_code=409,
                detail="Bu hesap aktif WhatsApp hesabı değil.",
            )
        conv = await self.get_conversation(
            account_id=account_id, conversation_id=conversation_id
        )

        token = await self._decrypt_token(account)
        url = _graph_url(account.api_version, f"{account.phone_number_id}/messages")
        payload = {
            "messaging_product": "whatsapp",
            "to": conv.wa_id,
            "type": "text",
            "text": {"body": body},
        }

        wamid: str | None = None
        api_status = MessageStatus.QUEUED
        error_message: str | None = None

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                )
        except httpx.HTTPError as exc:
            api_status = MessageStatus.FAILED
            error_message = f"network: {exc.__class__.__name__}"
            resp = None

        if resp is not None:
            if resp.status_code == 200:
                data: dict[str, Any] = resp.json()
                messages = data.get("messages") or []
                if messages:
                    wamid = messages[0].get("id")
                api_status = MessageStatus.SENT
            else:
                api_status = MessageStatus.FAILED
                try:
                    err = resp.json().get("error", {})
                except Exception:
                    err = {}
                meta_msg = err.get("message") or resp.text[:300]
                error_message = f"{resp.status_code}: {meta_msg}"

        message = WhatsAppChatMessage(
            conversation_id=conv.id,
            wamid=wamid,
            direction=MessageDirection.OUTBOUND,
            kind=MessageKind.TEXT,
            status=api_status,
            body=body,
            error_message=error_message,
            sent_by_user_id=sent_by_user_id,
        )
        self.session.add(message)

        if api_status != MessageStatus.FAILED:
            conv.last_message_text = body
            conv.last_message_at = datetime.now(timezone.utc)
            conv.last_message_direction = MessageDirection.OUTBOUND
            conv.unread_count = 0
            if conv.status == ConversationStatus.CLOSED:
                conv.status = ConversationStatus.OPEN
            self.session.add(conv)

        await self.session.commit()
        await self.session.refresh(message)

        if api_status == MessageStatus.FAILED:
            raise HTTPException(
                status_code=502,
                detail=error_message or "WhatsApp Cloud API hatası.",
            )

        return message

    async def start_conversation_with_text(
        self,
        *,
        to_phone_e164: str,
        body: str,
        contact_name: str | None,
        sent_by_user_id: int | None,
    ) -> tuple[WhatsAppConversation, WhatsAppChatMessage]:
        account = await self._get_active_account()
        conv = await self.get_or_create_conversation(
            account=account,
            wa_id=to_phone_e164,
            contact_name=contact_name,
        )
        msg = await self.send_text(
            account_id=account.id,
            conversation_id=conv.id,
            body=body,
            sent_by_user_id=sent_by_user_id,
        )
        await self.session.refresh(conv)
        return conv, msg

    # ─────────────────────────────────────────────────────────── webhook

    async def process_webhook_payload(self, body: dict[str, Any]) -> None:
        """
        Walks the Meta envelope and dispatches each `messages` change to
        `_persist_inbound_message`. Status updates (sent/delivered/read)
        update the local message status when we recognise the wamid.
        """
        entries = body.get("entry") or []
        for entry in entries:
            for change in entry.get("changes") or []:
                if change.get("field") != "messages":
                    continue
                value = change.get("value") or {}
                phone_number_id = (
                    value.get("metadata", {}).get("phone_number_id")
                )
                account = (
                    await self._get_account_by_phone_number_id(phone_number_id)
                    if phone_number_id
                    else None
                )
                if account is None:
                    logger.warning(
                        "Webhook for unknown phone_number_id=%s, skipping",
                        phone_number_id,
                    )
                    continue

                contacts = value.get("contacts") or []
                contact = contacts[0] if contacts else None

                for msg in value.get("messages") or []:
                    try:
                        await self._persist_inbound_message(
                            account=account, msg=msg, contact=contact
                        )
                    except Exception as exc:
                        logger.exception(
                            "Failed to persist inbound message: %s", exc
                        )

                for status_evt in value.get("statuses") or []:
                    try:
                        await self._apply_status_update(status_evt)
                    except Exception as exc:
                        logger.exception(
                            "Failed to apply status update: %s", exc
                        )

    async def _persist_inbound_message(
        self,
        *,
        account: WhatsAppAccount,
        msg: dict[str, Any],
        contact: dict[str, Any] | None,
    ) -> None:
        wa_id = msg.get("from")
        wamid = msg.get("id")
        msg_type = msg.get("type") or "other"
        timestamp = msg.get("timestamp")

        if not wa_id or not wamid:
            return

        existing = await self.session.execute(
            select(WhatsAppChatMessage.id).where(
                WhatsAppChatMessage.wamid == wamid
            )
        )
        if existing.scalar_one_or_none():
            return  # dedupe

        contact_name: str | None = None
        if contact:
            profile = contact.get("profile") or {}
            contact_name = profile.get("name")

        conv = await self.get_or_create_conversation(
            account=account,
            wa_id=wa_id,
            contact_name=contact_name,
        )

        kind = _KIND_FROM_TYPE.get(msg_type, MessageKind.OTHER)
        body, media_id, media_mime = _extract_body_and_media(msg, kind)

        created_at = (
            datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
            if timestamp
            else datetime.now(timezone.utc)
        )

        message = WhatsAppChatMessage(
            conversation_id=conv.id,
            wamid=wamid,
            direction=MessageDirection.INBOUND,
            kind=kind,
            status=MessageStatus.RECEIVED,
            body=body,
            media_id=media_id,
            media_mime_type=media_mime,
            raw_payload=msg,
            created_at=created_at,
        )
        self.session.add(message)

        conv.last_message_text = body or _kind_label(kind)
        conv.last_message_at = created_at
        conv.last_message_direction = MessageDirection.INBOUND
        conv.unread_count = (conv.unread_count or 0) + 1
        if conv.status == ConversationStatus.CLOSED:
            conv.status = ConversationStatus.OPEN
        self.session.add(conv)

        await self.session.commit()
        logger.info(
            "Inbound message wa_id=%s wamid=%s kind=%s", wa_id, wamid, kind
        )

    async def _apply_status_update(self, evt: dict[str, Any]) -> None:
        wamid = evt.get("id")
        new_status = evt.get("status")
        if not wamid or not new_status:
            return
        try:
            mapped = MessageStatus(new_status)
        except ValueError:
            return

        result = await self.session.execute(
            select(WhatsAppChatMessage).where(
                WhatsAppChatMessage.wamid == wamid
            )
        )
        message = result.scalar_one_or_none()
        if message is None:
            return
        message.status = mapped
        if new_status == "failed":
            errs = evt.get("errors") or []
            if errs:
                message.error_message = errs[0].get("title") or str(errs[0])
        self.session.add(message)
        await self.session.commit()


def _kind_label(kind: MessageKind) -> str:
    mapping = {
        MessageKind.TEXT: "Mesaj",
        MessageKind.IMAGE: "📷 Fotoğraf",
        MessageKind.VIDEO: "🎬 Video",
        MessageKind.AUDIO: "🎤 Ses mesajı",
        MessageKind.DOCUMENT: "📄 Belge",
        MessageKind.STICKER: "Çıkartma",
        MessageKind.LOCATION: "📍 Konum",
        MessageKind.CONTACTS: "👤 Kişi",
        MessageKind.INTERACTIVE: "Etkileşimli",
        MessageKind.BUTTON: "Buton",
        MessageKind.REACTION: "Tepki",
        MessageKind.SYSTEM: "Sistem mesajı",
        MessageKind.OTHER: "Mesaj",
    }
    return mapping.get(kind, "Mesaj")


def _extract_body_and_media(
    msg: dict[str, Any], kind: MessageKind
) -> tuple[str | None, str | None, str | None]:
    body: str | None = None
    media_id: str | None = None
    media_mime: str | None = None

    match kind:
        case MessageKind.TEXT:
            body = (msg.get("text") or {}).get("body")
        case MessageKind.IMAGE:
            data = msg.get("image") or {}
            body = data.get("caption")
            media_id = data.get("id")
            media_mime = data.get("mime_type")
        case MessageKind.VIDEO:
            data = msg.get("video") or {}
            body = data.get("caption")
            media_id = data.get("id")
            media_mime = data.get("mime_type")
        case MessageKind.AUDIO:
            data = msg.get("audio") or {}
            media_id = data.get("id")
            media_mime = data.get("mime_type")
            body = "Ses mesajı"
        case MessageKind.DOCUMENT:
            data = msg.get("document") or {}
            body = data.get("caption") or data.get("filename") or "Belge"
            media_id = data.get("id")
            media_mime = data.get("mime_type")
        case MessageKind.STICKER:
            data = msg.get("sticker") or {}
            media_id = data.get("id")
            media_mime = data.get("mime_type")
            body = "Çıkartma"
        case MessageKind.LOCATION:
            data = msg.get("location") or {}
            lat = data.get("latitude")
            lng = data.get("longitude")
            body = f"Konum: {lat}, {lng}" if lat and lng else "Konum"
        case MessageKind.CONTACTS:
            body = "Kişi paylaşımı"
        case MessageKind.INTERACTIVE:
            data = msg.get("interactive") or {}
            body = (
                (data.get("button_reply") or {}).get("title")
                or (data.get("list_reply") or {}).get("title")
                or "Etkileşimli mesaj"
            )
        case MessageKind.BUTTON:
            data = msg.get("button") or {}
            body = data.get("text") or "Buton"
        case MessageKind.REACTION:
            data = msg.get("reaction") or {}
            body = data.get("emoji") or "Tepki"
        case _:
            body = None

    return body, media_id, media_mime

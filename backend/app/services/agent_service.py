"""
WhatsApp AI agent service.

Pipeline:
  1. Pull conversation history (recent N messages)
  2. Resolve agent prompts from `ai_agent_prompts` (with default fallback)
  3. Build LangGraph + tools
  4. Invoke graph with the new inbound message
  5. Return assistant response text + metadata
"""

from __future__ import annotations

import logging
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.definitions import AGENT_DEFINITIONS, AgentDefinition
from app.agents.graph import build_graph
from app.agents.tools import build_order_tools, build_product_tools
from app.models.ai_agent_prompt import AiAgentPrompt
from app.models.whatsapp_chat import (
    MessageDirection,
    WhatsAppChatMessage,
    WhatsAppConversation,
)
from app.services.ai_service import AiService


logger = logging.getLogger("app.agents.service")


HISTORY_LIMIT = 30


class AgentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ---------------------------------------------------------------- prompts

    async def list_prompts(self) -> list[dict[str, Any]]:
        """List all agent definitions merged with DB overrides."""
        result = await self.session.execute(select(AiAgentPrompt))
        rows = {r.agent_key: r for r in result.scalars().all()}

        merged: list[dict[str, Any]] = []
        for d in AGENT_DEFINITIONS:
            row = rows.get(d.key)
            merged.append({
                "key": d.key,
                "name": d.name,
                "description": d.description,
                "tools": d.tools,
                "prompt": row.prompt if row else d.default_prompt,
                "enabled": row.enabled if row else True,
                "is_custom": row is not None,
            })
        return merged

    async def update_prompt(
        self, agent_key: str, prompt: str, enabled: bool | None = None
    ) -> dict[str, Any]:
        """Upsert the prompt for an agent."""
        definition = next(
            (d for d in AGENT_DEFINITIONS if d.key == agent_key), None
        )
        if not definition:
            raise ValueError(f"Bilinmeyen agent: {agent_key}")

        result = await self.session.execute(
            select(AiAgentPrompt).where(AiAgentPrompt.agent_key == agent_key)
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = AiAgentPrompt(
                agent_key=agent_key,
                name=definition.name,
                description=definition.description,
                prompt=prompt,
                enabled=True if enabled is None else enabled,
            )
            self.session.add(row)
        else:
            row.prompt = prompt
            if enabled is not None:
                row.enabled = enabled
        await self.session.commit()
        await self.session.refresh(row)

        return {
            "key": row.agent_key,
            "name": row.name,
            "description": row.description,
            "prompt": row.prompt,
            "enabled": row.enabled,
            "tools": definition.tools,
            "is_custom": True,
        }

    async def _resolve_prompts(self) -> dict[str, str]:
        """Resolve all prompts (DB override → default)."""
        result = await self.session.execute(select(AiAgentPrompt))
        rows = {r.agent_key: r for r in result.scalars().all()}
        return {
            d.key: (rows[d.key].prompt if d.key in rows else d.default_prompt)
            for d in AGENT_DEFINITIONS
        }

    # ---------------------------------------------------------------- run

    async def process_message(
        self,
        *,
        conversation: WhatsAppConversation,
        user_message: str,
    ) -> dict[str, Any]:
        """Run the agent graph for a new inbound user message."""
        nullresult = {
            "response_text": None,
            "needs_escalation": False,
            "route": "",
        }

        if not conversation.ai_enabled:
            return nullresult

        # 1. Get LLM
        ai_service = AiService(self.session)
        provider = await ai_service.get_default()
        if provider is None:
            logger.warning("No active AI provider; skipping agent run")
            return nullresult

        try:
            model = await ai_service.get_chat_model(provider)
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to load chat model: %s", exc)
            return nullresult

        # 2. Resolve prompts
        prompts = await self._resolve_prompts()

        # 3. Build tools (closures over current session)
        product_tools = build_product_tools(self.session)
        order_tools = build_order_tools(self.session)

        # 4. Build graph
        graph = build_graph(model, prompts, product_tools, order_tools)

        # 5. Load recent history
        history = await self._load_history(conversation.id, limit=HISTORY_LIMIT)
        messages: list[BaseMessage] = [*history, HumanMessage(content=user_message)]

        # 6. Detect previous agent (heuristic on last AI message)
        previous_agent = self._infer_previous_agent(history)

        # 7. Invoke
        try:
            result = await graph.ainvoke({
                "messages": messages,
                "conversation_id": conversation.id,
                "wa_id": conversation.wa_id,
                "contact_name": conversation.contact_name,
                "current_agent": "supervisor",
                "previous_agent": previous_agent,
                "response_text": "",
                "needs_escalation": False,
            })
        except Exception as exc:  # noqa: BLE001
            logger.exception("Agent graph failed: %s", exc)
            return nullresult

        return {
            "response_text": (result.get("response_text") or "").strip() or None,
            "needs_escalation": bool(result.get("needs_escalation")),
            "route": result.get("current_agent") or "",
        }

    async def _load_history(
        self, conversation_id: int, *, limit: int
    ) -> list[BaseMessage]:
        result = await self.session.execute(
            select(WhatsAppChatMessage)
            .where(WhatsAppChatMessage.conversation_id == conversation_id)
            .order_by(WhatsAppChatMessage.created_at.desc())
            .limit(limit)
        )
        rows = list(result.scalars().all())
        rows.reverse()  # chronological

        out: list[BaseMessage] = []
        for m in rows:
            if not m.body:
                continue
            if m.direction == MessageDirection.INBOUND:
                out.append(HumanMessage(content=m.body))
            else:
                # Both AI and human-agent outbound treated as AIMessage.
                # Prefix human-agent messages so the model has context.
                if m.is_ai_generated:
                    out.append(AIMessage(content=m.body))
                else:
                    out.append(AIMessage(content=f"[Müşteri Temsilcisi]: {m.body}"))
        return out

    @staticmethod
    def _infer_previous_agent(history: list[BaseMessage]) -> str:
        """Cheap heuristic on the last AI message to help supervisor route short replies."""
        for m in reversed(history):
            if isinstance(m, AIMessage) and isinstance(m.content, str):
                body = m.content.lower()
                if any(k in body for k in ("sipariş", "kargo", "teslim", "takip")):
                    return "order"
                if any(k in body for k in ("ürün", "stok", "fiyat", "kg", "₺")):
                    return "product_info"
                if any(k in body for k in ("temsilci", "yönlendir", "danış")):
                    return "escalation"
                return "greeting"
        return ""

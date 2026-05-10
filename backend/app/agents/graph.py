"""
LangGraph supervisor + worker pattern for WhatsApp AI agents.

Flow:
    START → supervisor → (route) → [greeting | product_info | order | escalation] → END

Each worker agent uses tool-calling (multi-turn loop).
"""

from __future__ import annotations

import logging
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import StructuredTool
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages


logger = logging.getLogger("app.agents.graph")


MAX_TOOL_ROUNDS = 5


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    conversation_id: int
    wa_id: str
    contact_name: str | None
    current_agent: str
    previous_agent: str
    response_text: str
    needs_escalation: bool


# ─────────────────────────────────────────────────────────── nodes


VALID_ROUTES = {"greeting", "product_info", "order", "escalation", "end"}


def _supervisor_node_factory(model: BaseChatModel, system_prompt: str):
    async def _run(state: AgentState) -> dict[str, Any]:
        prev = state.get("previous_agent") or ""
        prev_hint = (
            f"\nPREVIOUS ACTIVE AGENT: {prev} (use for short/contextual replies)"
            if prev
            else ""
        )

        instruction = f"""{system_prompt}

You are a routing assistant. Respond with ONLY one of these route names (no explanation):
- greeting
- product_info
- order
- escalation
- end

Routing rules:
- greeting: greetings, general questions, thank you
- product_info: product/stock/price questions
- order: order status, shipping/cargo tracking
- escalation: complaints, requests to speak with a human, complex issues
- end: conversation naturally concluded
- For short/contextual replies (e.g. "evet", "hayır", "tamam"), route to "{prev or 'greeting'}".
{prev_hint}
"""
        messages = [SystemMessage(content=instruction), *state["messages"]]
        resp = await model.ainvoke(messages)
        content = (resp.content or "").strip().lower() if isinstance(resp.content, str) else ""

        route = next((r for r in VALID_ROUTES if r in content), "greeting")
        logger.info(
            "Supervisor: raw='%s' resolved='%s' for conv=%s",
            content[:80],
            route,
            state.get("conversation_id"),
        )
        return {"current_agent": route, "previous_agent": route}

    return _run


def _worker_node_factory(
    model: BaseChatModel,
    system_prompt: str,
    tools: list[StructuredTool],
):
    """A worker agent with tool-calling loop."""
    if tools:
        bound = model.bind_tools(tools)
        tools_by_name = {t.name: t for t in tools}
    else:
        bound = model
        tools_by_name = {}

    async def _run(state: AgentState) -> dict[str, Any]:
        full_prompt = f"""{system_prompt}

CRITICAL:
- WhatsApp formatlama: *kalın*, _italik_ (tek yıldız/alt çizgi).
- Türkçe yanıt ver. Kısa ve doğal konuş (2-4 cümle).
- Müşterinin adını kullanma, "efendim" ile hitap et.
- Asla bot/AI olduğunu söyleme.
"""
        messages: list[BaseMessage] = [
            SystemMessage(content=full_prompt),
            *state["messages"],
        ]

        for round_idx in range(MAX_TOOL_ROUNDS):
            resp = await bound.ainvoke(messages)
            tool_calls = getattr(resp, "tool_calls", None) or []

            if not tool_calls:
                text = resp.content if isinstance(resp.content, str) else ""
                if not text.strip():
                    text = "Efendim kusura bakmayın bir aksaklık oldu, tekrar yazabilir misiniz?"
                return {
                    "messages": [AIMessage(content=text)],
                    "response_text": text.strip(),
                }

            logger.info(
                "Worker round %d: %d tool calls (%s)",
                round_idx + 1,
                len(tool_calls),
                ", ".join(tc["name"] for tc in tool_calls),
            )
            messages.append(resp)

            for tc in tool_calls:
                name = tc["name"]
                args = tc.get("args", {})
                tcid = tc.get("id") or name
                tool = tools_by_name.get(name)
                if tool is None:
                    messages.append(
                        ToolMessage(
                            content=f"Tool '{name}' bulunamadı.",
                            tool_call_id=tcid,
                        )
                    )
                    continue
                try:
                    result = await tool.ainvoke(args)
                except Exception as exc:  # noqa: BLE001
                    logger.exception("Tool %s failed: %s", name, exc)
                    result = f'{{"error": "{exc}"}}'
                messages.append(
                    ToolMessage(content=str(result), tool_call_id=tcid)
                )

        # Max rounds — force final text response
        logger.warning("Max tool rounds reached, forcing final response")
        messages.append(
            HumanMessage(
                content="[SYSTEM] Tool round limiti doldu. Toplanan bilgilerle "
                "müşteriye kısa bir cevap yaz, başka tool çağırma."
            )
        )
        final = await model.ainvoke(messages)
        text = (final.content if isinstance(final.content, str) else "").strip()
        if not text:
            text = "Efendim kontrol ediyorum, kısa süre içinde dönüş yapacağız."
        return {
            "messages": [AIMessage(content=text)],
            "response_text": text,
        }

    return _run


def _escalation_node_factory():
    async def _run(state: AgentState) -> dict[str, Any]:
        return {
            "needs_escalation": True,
            "response_text": "",
        }

    return _run


# ─────────────────────────────────────────────────────────── graph builder


def build_graph(
    model: BaseChatModel,
    prompts: dict[str, str],
    product_tools: list[StructuredTool],
    order_tools: list[StructuredTool],
):
    """
    Compile a LangGraph for the WhatsApp AI flow.

    `prompts` keys: supervisor, greeting, product_info, order, escalation
    """
    supervisor = _supervisor_node_factory(model, prompts["supervisor"])
    greeting = _worker_node_factory(model, prompts["greeting"], [])
    product_info = _worker_node_factory(model, prompts["product_info"], product_tools)
    # Order agent gets both product_info and order tools (so it can search products too)
    order = _worker_node_factory(
        model, prompts["order"], product_tools + order_tools
    )
    escalation = _escalation_node_factory()

    def route(state: AgentState) -> Literal[
        "greeting", "product_info", "order", "escalation", "__end__"
    ]:
        agent = state.get("current_agent", "greeting")
        if agent == "end":
            return END  # type: ignore[return-value]
        if agent in ("greeting", "product_info", "order", "escalation"):
            return agent  # type: ignore[return-value]
        return "greeting"

    g = StateGraph(AgentState)
    g.add_node("supervisor", supervisor)
    g.add_node("greeting", greeting)
    g.add_node("product_info", product_info)
    g.add_node("order", order)
    g.add_node("escalation", escalation)

    g.add_edge(START, "supervisor")
    g.add_conditional_edges("supervisor", route)
    g.add_edge("greeting", END)
    g.add_edge("product_info", END)
    g.add_edge("order", END)
    g.add_edge("escalation", END)

    return g.compile()

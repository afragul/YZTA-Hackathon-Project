"""
Admin AI Assistant endpoint — site-wide chatbot for the panel owner.

Answers questions about orders, shipments, stock, tasks using DB tools.
Stateless: frontend sends full message history each time.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DBSession
from app.agents.admin_tools import build_admin_tools
from app.services.ai_service import AiService

logger = logging.getLogger("app.assistant")

router = APIRouter(prefix="/assistant", tags=["assistant"])

SYSTEM_PROMPT = """Sen Anadolu Doğal Organik Gıda Kooperatifi'nin yönetim paneli asistanısın.
Panel sahibi (admin) sana işletme operasyonları hakkında sorular soruyor.

ERİŞEBİLECEĞİN ARAÇLAR:
- get_system_overview: Genel durum özeti (sipariş sayıları, satış, stok, kargo, görevler)
- list_orders: Siparişleri listele (status filtresi: pending/confirmed/preparing/shipped/delivered/cancelled)
- get_order_detail: Tek sipariş detayı (kalemler, müşteri, kargo)
- list_customers: Müşteri listesi veya arama
- search_products: Ürün arama (isim, SKU, kategori) + stok ve fiyat
- get_low_stock_products: Stoğu düşük ürünler
- list_shipments: Kargo listesi (status filtresi: in_transit/delayed/delivered vb.)
- list_tasks: Görev listesi (status filtresi: todo/in_progress/done)
- list_unread_notifications: Okunmamış bildirimler

CEVAP KURALLARI:
- Türkçe, kısa ve net cevap ver (2-6 cümle).
- Sayısal verileri vurgula: "5 bekleyen sipariş", "toplam 23.330₺ satış".
- Fiyatları ₺ ile göster.
- Admin'e profesyonel hitap et, "efendim" deme.
- Bilmediğin/erişemediğin şeyi uydurmak yerine açıkça söyle.
- Genel sorularda (kaç sipariş var, durum ne) önce get_system_overview çağır.
- Spesifik sorularda (X siparişi nerede, bal stokta mı) ilgili tool'u çağır.
- Tool sonuçlarını özetle, ham JSON döndürme.
- Listeyi gösterirken en fazla 5-6 öğe göster, "ve X tane daha" de."""


class ChatMessage(BaseModel):
    role: str = Field(description="user veya assistant")
    content: str


class AssistantRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)


class AssistantResponse(BaseModel):
    reply: str


@router.post(
    "/chat",
    response_model=AssistantResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin AI assistant chat",
)
async def assistant_chat(
    payload: AssistantRequest,
    _: CurrentUser,
    session: DBSession,
) -> AssistantResponse:
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

    # Get LLM
    ai_service = AiService(session)
    provider = await ai_service.get_default()
    if provider is None:
        return AssistantResponse(reply="AI sağlayıcısı yapılandırılmamış. Ayarlar → Entegrasyonlar'dan bağlayın.")

    try:
        model = await ai_service.get_chat_model(provider)
    except Exception as exc:
        logger.error("Assistant LLM error: %s", exc)
        return AssistantResponse(reply="AI modeline bağlanılamadı.")

    # Build tools
    all_tools = build_admin_tools(session)

    bound = model.bind_tools(all_tools)
    tools_by_name = {t.name: t for t in all_tools}

    # Build message history
    messages: list[Any] = [SystemMessage(content=SYSTEM_PROMPT)]
    for msg in payload.messages:
        if msg.role == "user":
            messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            messages.append(AIMessage(content=msg.content))

    # Multi-turn tool loop (max 5 rounds)
    for _ in range(5):
        resp = await bound.ainvoke(messages)
        tool_calls = getattr(resp, "tool_calls", None) or []

        if not tool_calls:
            text = resp.content if isinstance(resp.content, str) else ""
            return AssistantResponse(reply=text.strip() or "Bir sorun oluştu, tekrar deneyin.")

        messages.append(resp)
        for tc in tool_calls:
            tool = tools_by_name.get(tc["name"])
            if tool is None:
                messages.append(ToolMessage(content=f"Tool '{tc['name']}' bulunamadı.", tool_call_id=tc.get("id") or tc["name"]))
                continue
            try:
                result = await tool.ainvoke(tc.get("args", {}))
            except Exception as exc:
                result = f'{{"error": "{exc}"}}'
            messages.append(ToolMessage(content=str(result), tool_call_id=tc.get("id") or tc["name"]))

    # Force final response
    final = await model.ainvoke(messages)
    text = final.content if isinstance(final.content, str) else ""
    return AssistantResponse(reply=text.strip() or "Bilgileri topladım ama özetleyemedim, tekrar sorun.")

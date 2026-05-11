from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai_service import AiService

logger = logging.getLogger("app.analytics_agent")


COMPANY_NAME = "Anadolu Doğal Organik Gıda Kooperatifi"
COMPANY_SIGNATURE = "Anadolu Doğal Organik Gıda Kooperatifi Operasyon Ekibi"


class AnalyticsAgentService:
    """
    Panel tarafındaki AI Stok Önerileri için ayrı analytics agent servisi.

    Bu servis sayısal hesap yapmaz.
    Sayısal değerler products.py içinde deterministik olarak hesaplanır.
    Bu servis sadece:
    - operasyonel AI analiz metni
    - tedarikçi mail konusu
    - tedarikçi mail taslağı

    üretir.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.ai_service = AiService(session)

    async def generate_stock_suggestion_texts(self, payload: dict[str, Any]) -> dict[str, str]:
        """
        Düşük stok ürünü için AI destekli analiz ve mail taslağı üretir.

        AI Provider bağlı değilse veya model hata verirse fallback template döner.
        """

        fallback = self._fallback_response(payload)

        try:
            llm = await self.ai_service.get_chat_model()

            prompt = self._build_prompt(payload)

            response = await llm.ainvoke(prompt)

            raw_text = getattr(response, "content", None)

            if not raw_text:
                return fallback

            parsed = self._parse_json_response(str(raw_text))

            ai_message = parsed.get("ai_message") or fallback["ai_message"]
            mail_subject = parsed.get("mail_subject") or fallback["mail_subject"]
            mail_draft = parsed.get("mail_draft") or fallback["mail_draft"]

            return {
                "ai_message": self._sanitize_text(ai_message),
                "mail_subject": self._sanitize_text(mail_subject),
                "mail_draft": self._sanitize_mail_draft(mail_draft),
            }

        except Exception as exc:
            logger.warning("Analytics agent fallback used: %s", exc)
            return fallback

    def _build_prompt(self, payload: dict[str, Any]) -> str:
        return f"""
Sen KobAI adlı KOBİ operasyon yönetim platformunda çalışan bir analitik ajansın.

Görevin:
Verilen stok verisini yorumlamak ve tedarikçiye gönderilebilecek profesyonel bir Türkçe mail taslağı üretmek.

ÇOK ÖNEMLİ KURALLAR:
- Sayısal değerleri değiştirme.
- suggested_order_quantity değerini aynen kullan.
- current_stock, daily_average_sales, lead_time_days ve days_until_out_of_stock değerlerini aynen kullan.
- Yeni hesap yapma.
- Uydurma veri ekleme.
- Sadece Türkçe yaz.
- KOBİ / kooperatif operasyon diliyle profesyonel ama sade yaz.
- Cevabın sadece geçerli JSON olsun.
- Markdown kullanma.
- Kod bloğu kullanma.
- Mailde asla köşeli parantezli placeholder kullanma.
- [KOBİ Adı], [Kooperatif Adı], [Firma Adı], [Şirket Adı], [Yetkili], [İsim] gibi ifadeler yasaktır.
- Gönderici kurum adı olarak sadece "{COMPANY_NAME}" kullan.
- Mail imzası mutlaka şu şekilde bitsin:
Saygılarımızla,
{COMPANY_SIGNATURE}
- Mail metninde tedarikçiye hitap ederken supplier_name değerini kullanabilirsin.
- Mail metni gerçek bir operasyon ekibinden çıkmış gibi doğal, net ve gönderime hazır olsun.

Ürün verisi:
{json.dumps(payload, ensure_ascii=False, indent=2)}

Beklenen JSON formatı:
{{
  "ai_message": "Kısa ve net operasyonel analiz metni.",
  "mail_subject": "Stok Yenileme Talebi - Ürün Adı",
  "mail_draft": "Tedarikçiye gönderilecek profesyonel mail metni."
}}
""".strip()

    def _parse_json_response(self, raw_text: str) -> dict[str, Any]:
        """
        Model bazen JSON'u ```json içinde döndürebilir.
        Bu yüzden temizleyip parse ediyoruz.
        """

        cleaned = raw_text.strip()

        if cleaned.startswith("```json"):
            cleaned = cleaned.removeprefix("```json").strip()

        if cleaned.startswith("```"):
            cleaned = cleaned.removeprefix("```").strip()

        if cleaned.endswith("```"):
            cleaned = cleaned.removesuffix("```").strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("Analytics agent returned non-json response: %s", raw_text)
            return {}

        if not isinstance(data, dict):
            return {}

        return data

    def _sanitize_text(self, value: str) -> str:
        cleaned = str(value or "").strip()

        replacements = {
            "[KOBİ Adı/Kooperatif Adı]": COMPANY_SIGNATURE,
            "[KOBİ Adı]": COMPANY_NAME,
            "[Kooperatif Adı]": COMPANY_NAME,
            "[Firma Adı]": COMPANY_NAME,
            "[Şirket Adı]": COMPANY_NAME,
            "[Yetkili]": "yetkilisi",
            "[İsim]": "",
        }

        for old, new in replacements.items():
            cleaned = cleaned.replace(old, new)

        return cleaned.strip()

    def _sanitize_mail_draft(self, mail_draft: str) -> str:
        """
        LLM bazen [KOBİ Adı/Kooperatif Adı] gibi placeholder bırakabilir.
        Demo akışında bu kötü göründüğü için mail imzasını güvenli şekilde normalize ediyoruz.
        """

        cleaned = self._sanitize_text(mail_draft)

        # LLM'in bıraktığı bozuk veya eksik imzaları temizle.
        unwanted_signature_lines = [
            "Saygılarımızla,\n[KOBİ Adı/Kooperatif Adı]",
            "Saygılarımızla,\n[KOBİ Adı]",
            "Saygılarımızla,\n[Kooperatif Adı]",
            "Saygılarımızla,\n[Firma Adı]",
            "Saygılarımızla,\n[Şirket Adı]",
            "[KOBİ Adı/Kooperatif Adı]",
            "[KOBİ Adı]",
            "[Kooperatif Adı]",
            "[Firma Adı]",
            "[Şirket Adı]",
        ]

        for line in unwanted_signature_lines:
            cleaned = cleaned.replace(line, "")

        cleaned = cleaned.strip()

        # Eğer model "Saygılarımızla," yazmış ama doğru imzayı eklememişse,
        # en sondaki eksik imzayı tamamla.
        if COMPANY_SIGNATURE not in cleaned:
            if cleaned.endswith("Saygılarımızla,"):
                cleaned = cleaned.rstrip()
                cleaned += f"\n{COMPANY_SIGNATURE}"
            else:
                cleaned = cleaned.rstrip()
                cleaned += f"\n\nSaygılarımızla,\n{COMPANY_SIGNATURE}"

        return cleaned.strip()

    def _fallback_response(self, payload: dict[str, Any]) -> dict[str, str]:
        product_name = payload.get("product_name", "Ürün")
        sku = payload.get("sku", "-")
        current_stock = payload.get("current_stock", 0)
        daily_average_sales = payload.get("daily_average_sales", 0)
        lead_time_days = payload.get("lead_time_days", 0)
        days_until_out_of_stock = payload.get("days_until_out_of_stock", 0)
        suggested_order_quantity = payload.get("suggested_order_quantity", 0)
        supplier_name = payload.get("supplier_name", "Tedarikçi")

        ai_message = (
            f"{product_name} ürününün mevcut stoğu kritik seviyededir. "
            f"Günlük ortalama satış {daily_average_sales} adet, mevcut stok {current_stock} adettir. "
            f"Bu hızla stok yaklaşık {days_until_out_of_stock} gün içinde tükenebilir. "
            f"Tedarik süresi {lead_time_days} gün olduğu için "
            f"{suggested_order_quantity} adetlik sipariş taslağı oluşturulması önerilir."
        )

        mail_subject = f"Stok Yenileme Talebi - {product_name}"

        mail_draft = (
            f"Sayın {supplier_name} yetkilisi,\n\n"
            f"{product_name} ({sku}) ürünü için stok seviyemiz kritik seviyeye düşmüştür.\n\n"
            f"Mevcut stok: {current_stock} adet\n"
            f"Günlük ortalama satış: {daily_average_sales} adet\n"
            f"Tedarik süresi: {lead_time_days} gün\n"
            f"Önerilen sipariş miktarı: {suggested_order_quantity} adet\n\n"
            f"Bu doğrultuda {suggested_order_quantity} adetlik yeni sipariş oluşturmak istiyoruz.\n\n"
            f"Uygunluk ve tahmini teslim tarihi hakkında dönüşünüzü rica ederiz.\n\n"
            f"İyi çalışmalar.\n\n"
            f"Saygılarımızla,\n"
            f"{COMPANY_SIGNATURE}"
        )

        return {
            "ai_message": ai_message,
            "mail_subject": mail_subject,
            "mail_draft": mail_draft,
        }
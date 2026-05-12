"""AI product data readiness checker.

The checker inspects product data for customer-readiness gaps, then uses the
configured LangChain model to predict likely customer questions and data gaps.
"""

from __future__ import annotations

import json
import re
from typing import Any

from fastapi import HTTPException, status
from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.schemas.product import ProductDataCheckFaq, ProductDataCheckResult
from app.services.ai_service import AiService

QUALITY_CLAIM_TERMS = ("doğal", "organik", "katkısız", "sertifikalı")
DELIVERY_CLAIM_TERMS = ("ücretsiz kargo", "aynı gün", "hızlı teslimat")
PRODUCT_LIFESPAN_TERMS = ("son kullanma", "raf ömrü")
LINK_TERMS = ("[link]", "http://", "https://")

SHIPPING_TERMS = ("kargo", "teslim", "teslimat", "gönder")
STORAGE_TERMS = ("sakla", "saklama", "serin", "kuru", "buzdolabı", "muhafaza")


class ProductDataCheckService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def analyze(self, product: Product) -> ProductDataCheckResult:
        rule_strengths, rule_missing = _inspect_product_signals(product)
        prompt = _build_prompt(product, rule_strengths, rule_missing)

        ai_service = AiService(self.session)
        try:
            model = await ai_service.get_chat_model()
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"AI modeli yüklenemedi: {exc.__class__.__name__}",
            ) from exc

        payload, raw_text = await _invoke_json(
            model,
            [
                SystemMessage(content=_json_only_system_prompt()),
                HumanMessage(content=prompt),
            ],
        )

        if payload is None:
            payload = await _repair_json_with_ai(
                model=model,
                product=product,
                prompt=prompt,
                raw_text=raw_text,
            )

        if payload is None:
            payload = await _regenerate_compact_json(
                model=model,
                product=product,
                strengths=rule_strengths,
                missing=rule_missing,
            )

        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI geçerli yapılandırılmış yanıt üretemedi.",
            )

        return _normalize_result(
            product=product,
            payload=payload,
            fallback_strengths=rule_strengths,
            fallback_missing=rule_missing,
        )


async def _invoke_json(
    model: Any,
    messages: list[Any],
) -> tuple[dict[str, Any] | None, str]:
    try:
        response = await model.ainvoke(messages)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI yanıtı alınamadı: {exc.__class__.__name__}",
        ) from exc

    text = _message_text(response)
    try:
        return _parse_json(text), text
    except HTTPException:
        return None, text


async def _repair_json_with_ai(
    *,
    model: Any,
    product: Product,
    prompt: str,
    raw_text: str,
) -> dict[str, Any] | None:
    repair_prompt = (
        "Aşağıdaki AI yanıtı geçersiz veya yarım JSON oldu. Bunu ürün verisine "
        "sadık kalarak geçerli JSON objesine dönüştür.\n\n"
        f"İzinli ürün gerçekleri: {_allowed_facts(product)}\n\n"
        "Kesin kurallar:\n"
        "- JSON dışında hiçbir metin yazma.\n"
        "- Ürün verisinde olmayan içerik, menşe, ambalaj, kargo süresi, "
        "saklama koşulu, bağlantı/link, katkısızlık veya kullanım bilgisi uydurma.\n"
        "- FAQ içindeki question alanı mutlaka müşterinin soracağı gerçek bir soru olsun ve soru işaretiyle bitsin.\n"
        "- FAQ içinde müşteriye verilecek cevap, WhatsApp mesajı veya satış metni yazma.\n"
        "- data_status alanında sadece mevcut ürün verisinin bu soruyu cevaplamaya yetip yetmediğini belirt.\n"
        "- Bilgi yoksa needs_business_action=true yap ve action_note içinde hangi veri/entegrasyonun tamamlanması gerektiğini yaz.\n"
        "- Tam 3 muhtemel müşteri sorusu üret: mümkünse en az 1 tanesi mevcut veriden cevaplanabilir, en az 1 tanesi eksik veriyi ortaya çıkarır.\n"
        "- En fazla 5 etiket, en fazla 3 arama niyeti üret.\n\n"
        f"Orijinal görev:\n{prompt}\n\n"
        f"Geçersiz AI yanıtı:\n{raw_text[:3500]}"
    )
    payload, _ = await _invoke_json(
        model,
        [
            SystemMessage(
                content=(
                    "Sen yalnızca geçerli JSON üreten bir AI çıktı onarım ajanısın. "
                    "Markdown ve açıklama yazma."
                )
            ),
            HumanMessage(content=repair_prompt),
        ],
    )
    return payload


async def _regenerate_compact_json(
    *,
    model: Any,
    product: Product,
    strengths: list[str],
    missing: list[str],
) -> dict[str, Any] | None:
    product_json = _product_json(product)
    prompt = (
        "Ürün kartını analiz et ve yalnızca geçerli, kompakt JSON döndür.\n"
        f"Ürün verisi: {json.dumps(product_json, ensure_ascii=False)}\n"
        f"İzinli ürün gerçekleri: {_allowed_facts(product)}\n"
        f"Veride bulunan güçlü alanlar: {json.dumps(strengths, ensure_ascii=False)}\n"
        f"İşletmenin tamamlaması gereken veri eksikleri: {json.dumps(missing, ensure_ascii=False)}\n\n"
        "Şema: {\"summary\": string, \"strengths\": string[], "
        "\"missing_info\": string[], \"faq\": [{\"question\": string, "
        "\"data_status\": string, \"needs_business_action\": boolean, "
        "\"action_note\": string|null}], \"tags\": string[], "
        "\"search_intents\": string[]}\n\n"
        "Ürün verisinde olmayan özellikleri uydurma. FAQ içinde müşteriye verilecek "
        "cevap yazma. data_status sadece admin için veri yeterlilik durumunu açıklasın. "
        "Cevap verilemiyorsa needs_business_action=true yap ve action_note içinde "
        "tamamlanması gereken veri/entegrasyonu belirt. Ürün verisinde cevap varsa "
        "needs_business_action=false ve action_note=null döndür. Mesaj taslağı, "
        "satış metni, link veya otomatik gönderim cümlesi üretme. Tam 3 müşteri sorusu üret; "
        "mümkünse en az 1 tanesi mevcut veriden cevaplanabilir, en az 1 tanesi eksik veriyi ortaya çıkarır. "
        "5 etiket, 3 arama niyeti sınırını aşma. FAQ question alanı mutlaka gerçek "
        "müşteri sorusu olsun ve soru işaretiyle bitsin. search_intents yalnızca "
        "müşterinin site içi aramada yazabileceği, ürün verisine dayalı kısa ifadeler olsun."
    )
    payload, _ = await _invoke_json(
        model,
        [
            SystemMessage(content=_json_only_system_prompt()),
            HumanMessage(content=prompt),
        ],
    )
    return payload


def _json_only_system_prompt() -> str:
    return (
        "JSON dışında hiçbir metin yazma. Markdown kullanma. Yanıt ilk karakteri "
        "{ ve son karakteri } olan tek bir JSON objesi olmalı."
    )


def _inspect_product_signals(product: Product) -> tuple[list[str], list[str]]:
    strengths: list[str] = []
    missing: list[str] = []

    checks: list[tuple[bool, str, str]] = [
        (bool(product.name), "Ürün adı veride mevcut.", "İşletme verisinde ürün adı yok."),
        (bool(product.sku), "SKU veride mevcut.", "İşletme verisinde SKU yok."),
        (bool(product.category), "Kategori veride mevcut.", "İşletme verisinde kategori yok."),
        (float(product.price) > 0, "Fiyat bilgisi veride mevcut.", "İşletme verisinde fiyat bilgisi yok."),
        (float(product.stock) > 0, "Stok bilgisi veride mevcut.", "İşletme verisinde stok bilgisi yok."),
    ]
    for ok, strength, miss in checks:
        if ok:
            strengths.append(strength)
        else:
            missing.append(miss)

    description = (product.description or "").strip()
    searchable_text = " ".join(
        part for part in (product.name, product.sku, product.category, description) if part
    )
    lower = searchable_text.lower()
    if len(description) >= 120:
        strengths.append("Detaylı açıklama veride mevcut.")
    elif len(description) >= 40:
        strengths.append("Temel açıklama veride mevcut.")
        missing.append("Detaylı ürün açıklaması; kullanım, paketleme ve teslimat alanları netleştirilmeli.")
    else:
        missing.append("İşletme verisinde ürün açıklaması çok kısa veya yok.")

    semantic_checks: list[tuple[bool, str, str]] = [
        (
            any(k in lower for k in ("katkısız", "doğal", "organik", "geleneksel")),
            "İçerik veya üretim vaadi veride belirtilmiş.",
            "İşletme verisinde içerik, üretim yöntemi veya ürün vaadi net değil.",
        ),
        (
            any(k in lower for k in ("erzincan", "trabzon", "artvin", "rize", "hatay", "tokat", "ege", "ayvalık", "gemlik", "malatya", "giresun", "kars", "afyon", "bingöl", "aydın", "antep")),
            "Yöre veya menşe bilgisi veride mevcut.",
            "İşletme verisinde menşe veya üretim yeri ayrı ve net belirtilmemiş.",
        ),
        (
            any(k in lower for k in ("kavanoz", "paket", "ambalaj", "şişe", "kutu")),
            "Ambalaj bilgisi veride mevcut.",
            "İşletme verisinde ambalaj bilgisi yok.",
        ),
        (
            any(k in lower for k in ("sakla", "serin", "kuru", "buzdolabı")),
            "Saklama koşulu veride mevcut.",
            "İşletme verisinde saklama koşulu yok.",
        ),
        (
            any(k in lower for k in ("kargo", "teslim", "gönder")),
            "Teslimat/kargo bilgisi veride mevcut.",
            "İşletme verisinde kargo veya teslimat bilgisi yok.",
        ),
    ]
    for ok, strength, miss in semantic_checks:
        if ok:
            strengths.append(strength)
        else:
            missing.append(miss)

    return strengths[:6], missing[:8]


def _build_prompt(
    product: Product,
    strengths: list[str],
    missing: list[str],
) -> str:
    product_json = _product_json(product)
    return (
        "Aşağıdaki ürün kartını müşteri satın alma soruları ve veri eksikleri "
        "açısından değerlendir.\n\n"
        f"Ürün verisi:\n{json.dumps(product_json, ensure_ascii=False, indent=2)}\n\n"
        f"İzinli ürün gerçekleri: {_allowed_facts(product)}\n"
        f"Veride bulunan güçlü alanlar: {json.dumps(strengths, ensure_ascii=False)}\n"
        f"İşletmenin tamamlaması gereken veri eksikleri: {json.dumps(missing, ensure_ascii=False)}\n\n"
        "Sadece şu JSON şemasına uygun, kompakt yanıt ver:\n"
        "{\n"
        '  "summary": "1 cümlelik kısa değerlendirme",\n'
        '  "strengths": ["..."],\n'
        '  "missing_info": ["..."],\n'
        '  "faq": [{"question": "Müşteri bunu nasıl sorar?", "data_status": "Mevcut veri bu soruyu cevaplamaya yeterli/yetersiz.", "needs_business_action": false, "action_note": null}],\n'
        '  "tags": ["en fazla 5 etiket"],\n'
        '  "search_intents": ["müşterinin arama kutusuna yazabileceği en fazla 3 kısa ifade"]\n'
        "}\n\n"
        "Kurallar:\n"
        "- Türkçe yaz.\n"
        "- Ürün verisinde olmayan içerik, menşe, ambalaj, kargo süresi, saklama koşulu, link, katkısızlık veya kullanım bilgisi uydurma.\n"
        "- missing_info alanı müşteriye gösterilecek metin değil; işletmenin tamamlaması gereken ürün veri eksiklerini anlatsın.\n"
        "- FAQ içinde müşteriye verilecek cevap, WhatsApp taslağı, e-posta taslağı veya satış metni üretme.\n"
        "- data_status alanı müşteriye gösterilecek metin değil; admin için mevcut ürün verisinin soruyu cevaplamaya yetip yetmediğini anlatsın.\n"
        "- Yanıtlanamayan sorularda needs_business_action=true ve action_note alanında tamamlanması gereken veri/entegrasyonu yaz.\n"
        "- Ürün verisi soruyu cevaplıyorsa needs_business_action=false ve action_note=null kullan.\n"
        "- Kargo/teslimat bilgisi yoksa action_note içinde kargo entegrasyonu veya teslimat alanı bağlanmalı/tamamlanmalı de.\n"
        "- FAQ için dengeli dağılım yap: veri varsa fiyat/stok/menşe/kategori gibi cevaplanabilir sorulara da yer ver; sadece eksik veri soruları üretme.\n"
        "- Mevcut veriden cevaplanabilen FAQ için needs_business_action=false, data_status='Mevcut ürün verisi bu soruyu cevaplamak için yeterli.' ve action_note=null yaz.\n"
        "- FAQ question alanı mutlaka müşterinin soracağı gerçek bir soru olsun ve soru işaretiyle bitsin; cevap/uyarı cümlesini question alanına yazma.\n"
        "- Ürüne özel kal, işletme stratejisi önerme.\n"
        "- WhatsApp, e-posta veya satış mesajı taslağı üretme; sadece muhtemel müşteri sorusu, veri durumu ve işletme aksiyonu üret.\n"
        "- Link, URL, 'tıklayın' veya otomatik gönderim izlenimi verme.\n"
        "- Tam 3 FAQ yaz.\n"
        "- search_intents alanı müşterinin site içi arama kutusuna yazabileceği kısa ifadeler olsun; ürün verisinde olmayan kalite iddiası ekleme.\n"
        "- Tüm alanları kısa tut; kompakt JSON üret."
    )


def _product_json(product: Product) -> dict[str, Any]:
    return {
        "id": product.id,
        "sku": product.sku,
        "name": product.name,
        "description": product.description,
        "category": product.category,
        "unit": product.unit.value if product.unit else None,
        "price_try": float(product.price),
        "stock": float(product.stock),
        "low_stock_threshold": float(product.low_stock_threshold),
        "is_active": product.is_active,
    }


def _allowed_facts(product: Product) -> str:
    facts = [
        f"ad={product.name}",
        f"sku={product.sku}",
        f"kategori={product.category or 'belirtilmemiş'}",
        f"birim={product.unit.value if product.unit else 'belirtilmemiş'}",
        f"fiyat={float(product.price)} TRY",
        f"stok={float(product.stock)}",
    ]
    if product.description:
        facts.append(f"açıklama={product.description}")
    return "; ".join(facts)


def _message_text(response: Any) -> str:
    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text") or item.get("content")
                if text:
                    parts.append(str(text))
            else:
                parts.append(str(item))
        return "\n".join(parts)
    return str(content)


def _parse_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        if start < 0:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI geçerli JSON döndürmedi.",
            )
        try:
            data, _ = json.JSONDecoder().raw_decode(cleaned[start:])
        except json.JSONDecodeError as exc:
            match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
            if not match:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="AI geçerli JSON döndürmedi.",
                ) from exc
            try:
                data = json.loads(match.group(0))
            except json.JSONDecodeError as nested_exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="AI geçerli JSON döndürmedi.",
                ) from nested_exc
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI yanıtı beklenen obje formatında değil.",
        )
    return data


def _string_list(value: Any, fallback: list[str]) -> list[str]:
    if not isinstance(value, list):
        return fallback
    return [str(item).strip() for item in value if str(item).strip()]


def _faq_list(product: Product, value: Any) -> list[ProductDataCheckFaq]:
    if not isinstance(value, list):
        return []
    out: list[ProductDataCheckFaq] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        question = str(item.get("question") or "").strip()
        data_status = str(item.get("data_status") or "").strip()
        needs_business_action = bool(item.get("needs_business_action"))
        action_note = item.get("action_note")
        action_note_text = str(action_note).strip() if action_note else None
        question = _strip_unsupported_claims(product, question)
        data_status = _strip_unsupported_claims(product, data_status)
        if action_note_text:
            action_note_text = _strip_unsupported_claims(product, action_note_text)
        question = _normalize_customer_question(question, data_status)
        if question.lower().startswith("teslimat/kargo bilgisi"):
            question = "Kargo/teslimat bilgisi var mı?"
        if _is_generic_question(question):
            continue
        if not data_status:
            data_status = (
                "Mevcut ürün verisi bu soruyu cevaplamak için yetersiz."
                if needs_business_action
                else "Mevcut ürün verisi bu soruyu cevaplamak için yeterli."
            )
        data_status = _normalize_data_status(data_status, needs_business_action)
        if needs_business_action and not action_note_text:
            action_note_text = _default_action_note(question)
        if question:
            out.append(
                ProductDataCheckFaq(
                    question=question,
                    data_status=data_status,
                    needs_business_action=needs_business_action,
                    action_note=action_note_text,
                )
            )
    return out[:3]


def _normalize_data_status(value: str, needs_business_action: bool) -> str:
    lower = value.lower().strip()
    if lower in {"yetersiz", "eksik", "hayır", "veri yetersiz"}:
        return "Mevcut ürün verisi bu soruyu cevaplamak için yetersiz."
    if lower in {"yeterli", "evet", "veri yeterli"}:
        return "Mevcut ürün verisi bu soruyu cevaplamak için yeterli."
    if value.strip():
        return value.strip()
    return (
        "Mevcut ürün verisi bu soruyu cevaplamak için yetersiz."
        if needs_business_action
        else "Mevcut ürün verisi bu soruyu cevaplamak için yeterli."
    )


def _is_generic_question(question: str) -> bool:
    normalized = question.lower().strip()
    generic_questions = {
        "bu ürün hakkında hangi bilgiler net?",
        "bu ürün hakkında hangi bilgiler var?",
        "bu ürün hakkında bilgi var mı?",
    }
    return normalized in generic_questions


def _default_action_note(question: str) -> str:
    lower = question.lower()
    if any(term in lower for term in ("ambalaj", "paket", "paketleme", "kavanoz", "şişe", "kutu")):
        return "Ambalaj bilgisi ürün datasına eklenmeli."
    if any(term in lower for term in ("sakla", "saklama", "muhafaza")):
        return "Saklama koşulu ürün datasına eklenmeli."
    if any(term in lower for term in ("kargo", "teslim", "sipariş")):
        return "Kargo/teslimat alanı tamamlanmalı veya kargo entegrasyonu bağlanmalı."
    if any(term in lower for term in ("içerik", "katkı", "üretim")):
        return "İçerik, katkı veya üretim bilgisi ürün datasında netleştirilmeli."
    if any(term in lower for term in ("menşe", "yöre", "nerede")):
        return "Menşe veya üretim yeri ürün datasına ayrı ve net şekilde eklenmeli."
    return "Bu soruyu güvenle cevaplamak için ilgili ürün verisi tamamlanmalı."


def _ensure_three_customer_questions(
    product: Product,
    existing: list[ProductDataCheckFaq],
    missing: list[str],
) -> list[ProductDataCheckFaq]:
    out = _rebalance_customer_questions(product, existing[:3])
    seen = {item.question.lower() for item in out}

    fallback_questions: list[tuple[str, str, bool, str | None]] = []
    for item in missing:
        lower = item.lower()
        if any(term in lower for term in ("ambalaj", "paket", "paketleme")):
            fallback_questions.append(
                (
                    "Ürünün ambalaj bilgisi nedir?",
                    "Mevcut ürün verisi ambalaj sorusunu cevaplamak için yetersiz.",
                    True,
                    "Ambalaj bilgisi ürün datasına eklenmeli.",
                )
            )
        if any(term in lower for term in ("saklama", "sakla", "muhafaza")):
            fallback_questions.append(
                (
                    "Bu ürün nasıl saklanmalı?",
                    "Mevcut ürün verisi saklama koşulu sorusunu cevaplamak için yetersiz.",
                    True,
                    "Saklama koşulu ürün datasına eklenmeli.",
                )
            )
        if any(term in lower for term in ("kargo", "teslim")):
            fallback_questions.append(
                (
                    "Kargo/teslimat bilgisi var mı?",
                    "Mevcut ürün verisi kargo/teslimat sorusunu cevaplamak için yetersiz.",
                    True,
                    "Kargo/teslimat alanı tamamlanmalı veya kargo entegrasyonu bağlanmalı.",
                )
            )
        if any(term in lower for term in ("içerik", "üretim", "vaadi", "doğallık", "katkı")):
            fallback_questions.append(
                (
                    "Ürünün içerik veya üretim bilgisi nedir?",
                    "Mevcut ürün verisi içerik veya üretim sorusunu cevaplamak için yetersiz.",
                    True,
                    "İçerik, üretim yöntemi veya ürün vaadi ürün datasında netleştirilmeli.",
                )
            )
        if any(term in lower for term in ("menşe", "yöre", "üretim yeri")):
            fallback_questions.append(
                (
                    "Ürünün menşe veya üretim bilgisi nedir?",
                    "Mevcut ürün verisi menşe veya üretim yeri sorusunu cevaplamak için yetersiz.",
                    True,
                    "Menşe veya üretim yeri ürün datasına ayrı ve net şekilde eklenmeli.",
                )
            )

    fallback_questions.extend(
        [
            (
                f"{product.name} stokta var mı?",
                "Mevcut ürün verisinde stok bilgisi bulunduğu için bu soru cevaplanabilir.",
                False,
                None,
            ),
            (
                f"{product.name} fiyatı nedir?",
                "Mevcut ürün verisinde fiyat bilgisi bulunduğu için bu soru cevaplanabilir.",
                False,
                None,
            ),
        ]
    )

    for question, data_status, needs_business_action, action_note in fallback_questions:
        if len(out) >= 3:
            break
        key = question.lower()
        if key in seen:
            continue
        out.append(
            ProductDataCheckFaq(
                question=question,
                data_status=data_status,
                needs_business_action=needs_business_action,
                action_note=action_note,
            )
        )
        seen.add(key)
        if len(out) >= 3:
            break
    return out[:3]


def _rebalance_customer_questions(
    product: Product,
    items: list[ProductDataCheckFaq],
) -> list[ProductDataCheckFaq]:
    if not items:
        return []
    if any(not item.needs_business_action for item in items):
        return items

    supported = _supported_question(product)
    if not supported:
        return items

    return [supported, *items[:2]]


def _supported_question(product: Product) -> ProductDataCheckFaq | None:
    if float(product.stock) > 0:
        return ProductDataCheckFaq(
            question=f"{product.name} stokta var mı?",
            data_status="Mevcut ürün verisinde stok bilgisi bulunduğu için bu soru cevaplanabilir.",
            needs_business_action=False,
            action_note=None,
        )
    if float(product.price) > 0:
        return ProductDataCheckFaq(
            question=f"{product.name} fiyatı nedir?",
            data_status="Mevcut ürün verisinde fiyat bilgisi bulunduğu için bu soru cevaplanabilir.",
            needs_business_action=False,
            action_note=None,
        )
    if product.category:
        return ProductDataCheckFaq(
            question=f"{product.name} hangi kategoride?",
            data_status="Mevcut ürün verisinde kategori bilgisi bulunduğu için bu soru cevaplanabilir.",
            needs_business_action=False,
            action_note=None,
        )
    return None


def _normalize_customer_question(question: str, context: str) -> str:
    question = question.strip()
    if question.endswith("?"):
        return question

    combined = f"{question} {context}".lower()
    if any(term in combined for term in ("sakla", "saklama", "buzdolabı", "muhafaza")):
        return "Bu ürün nasıl saklanmalı?"
    if any(term in combined for term in ("kargo", "teslim", "teslimat", "gönder")):
        return "Kargo/teslimat bilgisi var mı?"
    if any(term in combined for term in ("ambalaj", "kavanoz", "paket", "şişe", "kutu")):
        return "Ürünün ambalaj bilgisi nedir?"
    if any(term in combined for term in ("katkı", "içerik", "katkısız")):
        return "Ürünün içerik veya katkı bilgisi var mı?"
    if any(term in combined for term in ("menşe", "üretim", "nerede", "yöre")):
        return "Ürünün menşe veya üretim bilgisi nedir?"
    return question if question else "Bu ürün hakkında hangi bilgiler net?"


def _normalize_strengths(value: Any, fallback: list[str]) -> list[str]:
    items = _string_list(value, fallback)
    return [
        item.replace("seziliyor", "veride mevcut")
        .replace("(seziliyor)", "(veride mevcut)")
        .replace("Açıklama (genel)", "Temel açıklama")
        for item in items
    ]


def _normalize_result(
    *,
    product: Product,
    payload: dict[str, Any],
    fallback_strengths: list[str],
    fallback_missing: list[str],
) -> ProductDataCheckResult:
    summary = str(payload.get("summary") or "").strip()
    if not summary:
        summary = "Ürün kartı daha fazla müşteri sorusunu cevaplayacak şekilde güçlendirilebilir."
    summary = _strip_unsupported_claims(product, summary)

    tags = [
        cleaned
        for item in _string_list(payload.get("tags"), [])[:5]
        if (cleaned := _strip_unsupported_claims(product, item)).strip()
    ]
    search_intents = [
        cleaned
        for item in _string_list(payload.get("search_intents"), [])[:3]
        if (cleaned := _strip_unsupported_claims(product, item)).strip()
    ]
    missing_info = _string_list(payload.get("missing_info"), fallback_missing)[:8]
    faq = _ensure_three_customer_questions(
        product=product,
        existing=_faq_list(product, payload.get("faq")),
        missing=missing_info,
    )

    return ProductDataCheckResult(
        product_id=product.id,
        sku=product.sku,
        name=product.name,
        summary=summary,
        strengths=_normalize_strengths(payload.get("strengths"), fallback_strengths)[:6],
        missing_info=missing_info,
        faq=faq,
        tags=tags,
        search_intents=search_intents,
        source="ai",
    )


def _strip_unsupported_claims(product: Product, text: str) -> str:
    allowed = json.dumps(_product_json(product), ensure_ascii=False).lower()
    guarded_terms = (
        *QUALITY_CLAIM_TERMS,
        *DELIVERY_CLAIM_TERMS,
        *PRODUCT_LIFESPAN_TERMS,
        *LINK_TERMS,
    )
    cleaned = _drop_unsupported_sentences(text, allowed, guarded_terms)
    cleaned = _strip_unsupported_link_claim(cleaned)
    if not _has_shipping_fact(product):
        cleaned = _strip_unsupported_shipping_claim(cleaned)
    if not _has_storage_fact(product):
        cleaned = _strip_unsupported_storage_claim(cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    cleaned = re.sub(r"\s+([,.!?;:])", r"\1", cleaned)
    return cleaned.strip(" -")


def _drop_unsupported_sentences(
    text: str,
    allowed: str,
    risky_terms: tuple[str, ...],
) -> str:
    chunks = re.split(r"(?<=[.!?])\s+", text)
    kept: list[str] = []
    for chunk in chunks:
        lower = chunk.lower()
        has_unsupported = any(term in lower and term not in allowed for term in risky_terms)
        if not has_unsupported:
            kept.append(chunk)
    return " ".join(kept)


def _has_shipping_fact(product: Product) -> bool:
    text = f"{product.name} {product.description or ''}".lower()
    return any(term in text for term in SHIPPING_TERMS)


def _has_storage_fact(product: Product) -> bool:
    text = f"{product.name} {product.description or ''}".lower()
    return any(term in text for term in STORAGE_TERMS)


def _strip_unsupported_link_claim(text: str) -> str:
    cleaned = re.sub(r"\[link\]", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"https?://\S+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"sipariş vermek için tıklayın[:：]?", "sipariş linki ürün verisinde yok", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"tıklayın[:：]?", "link bilgisi ürün verisinde yok", cleaned, flags=re.IGNORECASE)
    return cleaned


def _strip_unsupported_shipping_claim(text: str) -> str:
    lower = text.lower()
    if not any(term in lower for term in ("kargo", "teslim", "teslimat")):
        return text
    hard_claims = (
        "teslimat süresi",
        "bulunduğunuz konuma",
        "siparişiniz sonrası",
        "gönderilir",
        "gönderilmektedir",
        "gönderilecek",
        "teslim edilir",
    )
    if any(claim in lower for claim in hard_claims):
        return "Kargo/teslimat alanı ürün datasında yok; alan tamamlanmalı veya kargo entegrasyonu bağlanmalı."
    safe_markers = (
        "belirtilmemiş",
        "eksik",
        "net değil",
        "verisinde yok",
        "tamamlanmalı",
        "entegrasyon",
    )
    if any(marker in lower for marker in safe_markers):
        return text
    return "Kargo/teslimat alanı ürün datasında yok; alan tamamlanmalı veya kargo entegrasyonu bağlanmalı."


def _strip_unsupported_storage_claim(text: str) -> str:
    lower = text.lower()
    if not any(term in lower for term in STORAGE_TERMS):
        return text
    safe_markers = (
        "belirtilmemiş",
        "eksik",
        "net değil",
        "verisinde yok",
        "tamamlanmalı",
    )
    if any(marker in lower for marker in safe_markers):
        return text
    return "Saklama koşulu ürün datasında yok; saklama alanı tamamlanmalı."

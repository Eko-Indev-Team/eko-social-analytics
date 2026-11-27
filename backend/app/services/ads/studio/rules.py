"""Locked creative rules and guardrails for Ad Studio (port of AdMarketer ``src/creative/captions.py`` + ``copy_gen.py``).

Source: Eko's approved ads document (Eko_SBI_Facebook_Instagram_Ads_Documentation.docx, section 9), as enforced by
AdMarketer. These are *final* approved texts, not suggestions:

* only the 4 approved Hindi CTAs may be used (each maps to a Meta call-to-action type);
* "Check Eligibility" / "पात्रता जांचें" messaging is banned;
* every ad uses exactly one of 3 creative angles.

This module is pure (no I/O) so the rules can be tested and reused by any caller.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Verbatim from the locked document, "hook | body | cta" (cta always one of the 4 approved phrases).
LOCKED_CAPTIONS: list[str] = [
    "SBI Kiosk Operator बनने का अवसर | अपने इलाके में बैंकिंग सेवाओं से जुड़ें | आज ही आवेदन करें",
    "अपने इलाके में नई पहचान बनाएं | लोगों तक बैंकिंग सेवाएं पहुंचाएं | आज ही शुरुआत करें",
    "अपने इलाके के लोगों तक बैंकिंग सेवाएं पहुंचाएं | SBI Kiosk Operator बनने का अवसर जानें | अभी आवेदन करें",
    "क्या आप एक नया व्यवसायिक अवसर तलाश रहे हैं? | SBI Kiosk Operator बनने की प्रक्रिया जानें | आज ही आवेदन करें",
    "अपने इलाके में बैंकिंग सेवाओं का हिस्सा बनें | SBI Kiosk Operator बनने का अवसर जानें | अभी जानकारी प्राप्त करें",
]

# Not part of the locked document (AdMarketer's own default bullet set for the recruitment angle).
DEFAULT_BULLETS: list[str] = [
    "स्थिर मासिक आय का अवसर",
    "अपने क्षेत्र में सम्मानजनक कार्य",
    "SBI के साथ सीधा जुड़ाव",
    "प्रशिक्षण एवं सहयोग उपलब्ध",
]

APPROVED_CTAS: list[str] = [
    "आज ही आवेदन करें",
    "अभी आवेदन करें",
    "आज ही शुरुआत करें",
    "अभी जानकारी प्राप्त करें",
]
CTA_TO_META_TYPE: dict[str, str] = {
    "आज ही आवेदन करें": "APPLY_NOW",
    "अभी आवेदन करें": "APPLY_NOW",
    "आज ही शुरुआत करें": "SIGN_UP",
    "अभी जानकारी प्राप्त करें": "LEARN_MORE",
}
APPROVED_ANGLES: list[str] = ["general_opportunity", "women_first", "shop_owner"]
ANGLE_LABELS: dict[str, str] = {
    "general_opportunity": "General opportunity",
    "women_first": "Women-first",
    "shop_owner": "Shop-owner",
}
ANGLE_GUIDANCE: dict[str, str] = {
    "general_opportunity": "Broad appeal — anyone in the community who wants a stable local income opportunity.",
    "women_first": "Speak directly to women — running a CSP kiosk as a respected, safe, local income source for women.",
    "shop_owner": "Speak to existing shop/kirana store owners — add a CSP kiosk to their existing shop for extra income.",
}
BANNED_PHRASES: list[str] = ["Check Eligibility", "पात्रता जांचें", "पात्रता जांच"]

OBJECTIVE_MAP: dict[str, str] = {
    "leads": "OUTCOME_LEADS",
    "sales": "OUTCOME_SALES",
    "traffic": "OUTCOME_TRAFFIC",
    "awareness": "OUTCOME_AWARENESS",
    "engagement": "OUTCOME_ENGAGEMENT",
}

# AdMarketer src/targeting.py
STATIC_FALLBACK_DISTRICTS: list[str] = ["Dhule", "Nashik", "Thane", "Gorakhpur", "Deoria", "Lucknow", "Sitapur", "Moradabad", "Amroha", "Jaipur"]
EXCLUDED_DISTRICTS: list[str] = ["Kheri"]  # 7 CSPs already there, flagged saturated

DEFAULT_BRIEF = {
    "product": "SBI Kiosk Operator / CSP Agent opportunity",
    "description": "Run your own SBI Customer Service Point (CSP) kiosk and earn a stable local income.",
    "objective": "leads",
    "tone": "friendly, trustworthy, aspirational",
    "visual_style": "warm documentary photo-realistic",
    "language": "hindi",
    "angle": "general_opportunity",
}
DEFAULT_DESTINATION_URL = "https://kiosk.eko.in/signup"
URL_TAGS = "utm_source=fb&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}"

# Fields of an ad copy that end up in the ad and are therefore checked for banned wording.
COPY_TEXT_FIELDS = ("headline_line1", "headline_line2", "subheading", "primary_text", "description", "headline")


@dataclass
class GuardrailReport:
    ok: bool = True
    violations: list[str] = field(default_factory=list)  # human-readable, for rejected user input
    removed_phrases: list[str] = field(default_factory=list)  # banned phrases stripped from generated copy
    cta_replaced: bool = False  # generated CTA was not approved and was replaced with the first approved one

    def as_dict(self) -> dict:
        return {"ok": self.ok, "violations": self.violations, "removed_phrases": self.removed_phrases, "cta_replaced": self.cta_replaced}


def banned_phrases_in(text: str | None) -> list[str]:
    low = (text or "").lower()
    return [p for p in BANNED_PHRASES if p.lower() in low]


def check_copy(copy: dict) -> GuardrailReport:
    """Strict check for copy a person submitted: anything outside the locked rules is a violation (nothing is changed)."""
    report = GuardrailReport()
    if copy.get("cta_text") not in APPROVED_CTAS:
        report.violations.append("The call-to-action must be one of the 4 approved phrases.")
    if copy.get("angle") is not None and copy.get("angle") not in APPROVED_ANGLES:
        report.violations.append("The creative angle must be one of: " + ", ".join(APPROVED_ANGLES) + ".")
    texts = [copy.get(f) for f in COPY_TEXT_FIELDS] + list(copy.get("bullets") or [])
    found = sorted({p for t in texts for p in banned_phrases_in(t)})
    for phrase in found:
        report.violations.append(f"“{phrase}” wording is not allowed (eligibility-check messaging is banned).")
    report.ok = not report.violations
    return report


def _strip_banned(text: str) -> tuple[str, list[str]]:
    removed: list[str] = []
    for phrase in BANNED_PHRASES:
        lower = text.lower()
        idx = lower.find(phrase.lower())
        while idx != -1:
            text = text[:idx] + text[idx + len(phrase):]
            removed.append(phrase)
            lower = text.lower()
            idx = lower.find(phrase.lower())
    return " ".join(text.split()), removed


def enforce_generated(copy: dict, *, fallback_bullet: str) -> tuple[dict, GuardrailReport]:
    """AdMarketer ``_validate_and_fix``: generated copy is *repaired* (unapproved CTA replaced, banned phrases
    stripped, bullets containing them dropped) and every repair is reported — never silently."""
    report = GuardrailReport()
    out = dict(copy)
    if out.get("cta_text") not in APPROVED_CTAS:
        out["cta_text"] = APPROVED_CTAS[0]
        report.cta_replaced = True
    out["cta"] = CTA_TO_META_TYPE[out["cta_text"]]
    for f in COPY_TEXT_FIELDS:
        cleaned, removed = _strip_banned(out.get(f) or "")
        out[f] = cleaned
        report.removed_phrases.extend(removed)
    bullets = []
    for b in out.get("bullets") or []:
        found = banned_phrases_in(b)
        if found:
            report.removed_phrases.extend(found)
        else:
            bullets.append(b)
    out["bullets"] = bullets[:4] or [fallback_bullet]
    return out, report


def caption_to_copy(index: int) -> dict:
    """Locked caption (1-5) → ad-copy dict (AdMarketer ``caption_to_ad_copy``)."""
    if not 1 <= index <= len(LOCKED_CAPTIONS):
        raise ValueError(f"Locked caption index must be 1-{len(LOCKED_CAPTIONS)}")
    hook, body, cta_text = [p.strip() for p in LOCKED_CAPTIONS[index - 1].split("|")]
    return {
        "headline_line1": hook,
        "headline_line2": "",
        "subheading": body,
        "primary_text": f"{hook} {body}",
        "description": body,
        "bullets": list(DEFAULT_BULLETS),
        "cta_text": cta_text,
        "cta": CTA_TO_META_TYPE.get(cta_text, "LEARN_MORE"),
        "headline": hook,
        "caption_index": index,
    }


def locked_captions() -> list[dict]:
    out = []
    for i, raw in enumerate(LOCKED_CAPTIONS, start=1):
        hook, body, cta_text = [p.strip() for p in raw.split("|")]
        out.append({"index": i, "text": raw, "hook": hook, "body": body, "cta_text": cta_text, "cta": CTA_TO_META_TYPE[cta_text]})
    return out

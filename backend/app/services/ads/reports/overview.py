"""Dashboard totals and the Overview page (Lead Form leads and website signups side by side).

Ports of AdMarketer ``webapp/app.py`` ``_apply_ads`` (the totals part) and ``overview_page``.
Pure functions over ad-record and signup dicts.

One deliberate difference: AdMarketer's overview counted only ``objective == "LEAD_GENERATION"`` as a
lead-form ad, while every other page (Performance, the dashboard channel) also treats Meta's newer
``OUTCOME_LEADS`` objective as a lead form. Here the overview uses the same rule as Performance
(``FORM_OBJECTIVES``) so the two pages never disagree about which ads are lead-form ads.
"""

from __future__ import annotations

from .performance import STATUS_LABELS, is_form, normalize_ad, status_counts


def dashboard_totals(ads: list[dict]) -> dict:
    """The totals AdMarketer kept in ``_DASHBOARD_TOTALS`` (Experiments reads leads / pincode / qualified)."""
    ads = [normalize_ad(a) for a in ads]
    return {
        "impressions": sum(a["metrics"]["impressions"] for a in ads),
        "reach": sum(a["metrics"]["reach"] for a in ads),
        "clicks": sum(a["metrics"]["clicks"] for a in ads),
        "link_clicks": sum(a["metrics"]["link_clicks"] for a in ads),
        "landing_page_views": sum(a["metrics"]["landing_page_views"] for a in ads),
        "leads": sum(a["metrics"]["leads"] for a in ads),
        "pincode_qualified_leads": sum(1 for a in ads for lead in a["leads_data"] if lead.get("pincode_qualified")),
        "qualified_leads": sum(1 for a in ads for lead in a["leads_data"] if lead.get("qualified")),
        "lead_status_counts": status_counts(lead for a in ads for lead in a["leads_data"]),
        "spend": round(sum(a["metrics"]["spend"] for a in ads), 2),
        "active_count": sum(1 for a in ads if a["status"] == "ACTIVE"),
        "completed_count": sum(1 for a in ads if a["status"] == "COMPLETED"),
        "other_count": sum(1 for a in ads if a["status"] not in ("ACTIVE", "COMPLETED")),
    }


def build(ads: list[dict], signups: list[dict]) -> dict:
    ads = [normalize_ad(a) for a in ads]
    form_ads = [a for a in ads if is_form(a)]
    form_leads = sum(a["metrics"]["leads"] for a in form_ads)
    form_pincode_qualified = sum(1 for a in form_ads for lead in a["leads_data"] if lead.get("pincode_qualified"))
    form_pincode_checkable = sum(len(a["leads_data"]) for a in form_ads if a["targeting_summary"].get("pincode_check_ok"))
    form_qualified = sum(1 for a in form_ads for lead in a["leads_data"] if lead.get("qualified"))

    url_signups_total = len(signups)
    url_signups_facebook = sum(1 for s in signups if (s.get("attribution_tier") or "none") != "none")
    url_strong_qualify = sum(1 for s in signups if s.get("qualification_verdict") == "STRONG_QUALIFY")
    url_not_qualify = sum(1 for s in signups if s.get("qualification_verdict") and s.get("qualification_verdict") != "STRONG_QUALIFY")

    return {
        "has_ad_data": bool(ads),
        "form_leads": form_leads,
        "form_qualified": form_qualified,  # strongly qualified = sbi_strong + esaf_strong
        "form_status_counts": status_counts(lead for a in form_ads for lead in a["leads_data"]),
        "status_labels": STATUS_LABELS,
        "form_pincode_qualified": form_pincode_qualified,
        "form_pincode_checkable": form_pincode_checkable,
        "url_signups_total": url_signups_total,
        "url_signups_facebook": url_signups_facebook,
        "url_strong_qualify": url_strong_qualify,
        "url_not_qualify": url_not_qualify,
        "overall_total": form_leads + url_signups_total,
    }


def signup_totals(signups: list[dict], ads: list[dict]) -> dict:
    """Port of the ``/signups`` page totals (always over *all* signups, before any filter)."""
    ads = [normalize_ad(a) for a in ads]
    tiers = [s.get("attribution_tier") or "none" for s in signups]
    totals = {
        "total_signups": len(signups),
        "campaign_matched": tiers.count("campaign_matched"),
        "fbclid_only": tiers.count("fbclid_only"),
        "not_facebook": tiers.count("none"),
        "strong_qualify": sum(1 for s in signups if s.get("qualification_verdict") == "STRONG_QUALIFY"),
        "facebook_lead_form_leads": sum(a["metrics"]["leads"] for a in ads if is_form(a)),
    }
    totals["facebook_attributed"] = totals["campaign_matched"] + totals["fbclid_only"]
    return totals

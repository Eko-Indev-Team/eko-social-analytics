"""Rule-based advice for a built ad (port of AdMarketer ``src/agent/optimizer.py`` + the webapp's plain-language texts).

Bounded and advisory only: it never acts on its own and never raises its own spend ceiling.
"""

from __future__ import annotations

ACTION_EXPLANATIONS = {
    "pause": {"tone": "warn", "text": "You've spent more than your daily budget. Consider pausing this ad or raising the budget."},
    "increase_budget": {"tone": "good", "text": "This ad is getting good results for a low cost. You could reach more people by increasing the budget."},
    "flag_fatigue": {"tone": "warn", "text": "The same people are seeing this ad too many times. It may be time to refresh the picture or wording."},
    "hold": {"tone": "good", "text": "Everything looks fine. No action needed right now."},
}


def evaluate(metrics: dict, guardrails: dict) -> list[tuple[str, str]]:
    """guardrails: {"max_daily_spend": float, "target_cpa": float | None} → [(action, reason)]."""
    actions: list[tuple[str, str]] = []
    spend = metrics.get("spend") or 0
    if guardrails.get("max_daily_spend") is not None and spend > guardrails["max_daily_spend"]:
        actions.append(("pause", f"Spend {spend} exceeded max_daily_spend {guardrails['max_daily_spend']}"))

    cpa = metrics.get("cpa")
    target = guardrails.get("target_cpa")
    if cpa is not None and target and cpa > target * 1.5:
        actions.append(("pause", f"CPA {cpa} is 1.5x above target_cpa {target}"))
    elif cpa is not None and target and cpa < target * 0.7:
        actions.append(("increase_budget", f"CPA {cpa} well under target {target}, performing well"))

    if (metrics.get("frequency") or 0) > 4:
        actions.append(("flag_fatigue", f"Frequency {metrics['frequency']} is high, audience may be fatigued"))

    if not actions:
        actions.append(("hold", "Within guardrails, no action needed"))
    return actions


def explain(actions: list[tuple[str, str]]) -> list[dict]:
    return [{"action": a, "reason": r, **ACTION_EXPLANATIONS.get(a, {"tone": "good", "text": r})} for a, r in actions]

"""Ad Studio targeting from Eko's reference datasets (port of AdMarketer ``src/targeting.py`` + ``src/meta/village_targeting.py``).

Pure functions over the reference datasets (``ads_reference_datasets`` rows, name → JSON list):

* ``csp_geocoded``                    — existing-CSP points in the original 10 UP/Maharashtra/Rajasthan districts;
* ``punjab_haryana_tehsils_geocoded`` — Punjab/Haryana tehsil centres (stated ~20 km catchment);
* ``csp_villages_geocoded``           — villages around CSPs with a looked-up PIN code (village- or tehsil-level match).

District targeting = lat/lon radius anchors (Meta ``custom_locations``), exactly as AdMarketer's live branch did.
Village targeting (new in SocialBoard) = the villages' PIN codes as Meta ``zips`` (``IN:<pincode>`` keys, the format
AdMarketer read back from real ads). Districts without anchors stay ``unresolvedDistricts``; a live publish resolves
them with Meta's location search (AdMarketer ``geo_resolver``) or refuses.
"""

from __future__ import annotations

from collections import Counter

from . import rules

# Radius scales with how precise the geocode match was (AdMarketer RADIUS_BY_LEVEL_KM).
RADIUS_BY_LEVEL_KM = {"village": 12, "tehsil": 18, "district": 25}
PUNJAB_HARYANA_RADIUS_KM = 20
DEFAULT_RADIUS_KM = 20
# District-name search fallback (AdMarketer geo_resolver) — used only on a live publish.
DISTRICT_STATE_HINTS = {
    "Dhule": "Maharashtra", "Nashik": "Maharashtra", "Thane": "Maharashtra", "Gorakhpur": "Uttar Pradesh",
    "Deoria": "Uttar Pradesh", "Lucknow": "Uttar Pradesh", "Sitapur": "Uttar Pradesh", "Moradabad": "Uttar Pradesh",
    "Amroha": "Uttar Pradesh", "Jaipur": "Rajasthan",
}
SEARCH_RADIUS_KM = 50
REFERENCE_DATASETS = ("csp_geocoded", "punjab_haryana_tehsils_geocoded", "csp_villages_geocoded", "district_level_geocoded")
MAX_VILLAGES = 500

Datasets = dict[str, list]


def _rows(datasets: Datasets, name: str) -> list[dict]:
    data = datasets.get(name) or []
    return [r for r in data if isinstance(r, dict)] if isinstance(data, list) else []


def _norm(name: str | None) -> str:
    return " ".join(str(name or "").split()).upper()


def _title(name: str) -> str:
    return " ".join(w.capitalize() for w in str(name).split())


def load_anchors(datasets: Datasets) -> list[dict]:
    """AdMarketer ``load_all_locations``: existing-CSP anchors + Punjab/Haryana tehsil anchors."""
    out: list[dict] = []
    for row in _rows(datasets, "csp_geocoded"):
        geo = row.get("geo")
        if not isinstance(geo, dict) or geo.get("lat") is None or geo.get("lon") is None:
            continue
        level = geo.get("matched_level")
        out.append({"district": _title(row.get("district", "")), "tehsil": row.get("tehsil"), "anchor": row.get("village"),
                    "state": row.get("state"), "lat": float(geo["lat"]), "lon": float(geo["lon"]),
                    "radius_km": RADIUS_BY_LEVEL_KM.get(level, DEFAULT_RADIUS_KM), "match_precision": level, "source": "existing_csp"})
    for row in _rows(datasets, "punjab_haryana_tehsils_geocoded"):
        geo = row.get("geo")
        if not isinstance(geo, dict) or geo.get("lat") is None or geo.get("lon") is None:
            continue
        out.append({"district": _title(row.get("district", "")), "tehsil": row.get("tehsil"), "anchor": row.get("tehsil"),
                    "state": row.get("state"), "lat": float(geo["lat"]), "lon": float(geo["lon"]), "radius_km": PUNJAB_HARYANA_RADIUS_KM,
                    "match_precision": geo.get("matched_level"), "source": "punjab_haryana_expansion"})
    return out


def load_villages(datasets: Datasets) -> list[dict]:
    seen: Counter[str] = Counter()
    out: list[dict] = []
    for row in _rows(datasets, "csp_villages_geocoded"):
        base = str(row.get("tv_code") or f"{_norm(row.get('district'))}-{_norm(row.get('village_clean'))}")[:60]
        seen[base] += 1
        code = base if seen[base] == 1 else f"{base}~{seen[base]}"
        pincode = str(row.get("pincode") or "").strip()
        level = row.get("match_level") if row.get("match_level") in ("village", "tehsil", "district") else None
        out.append({"code": code, "village": row.get("village_clean") or row.get("village_raw"), "tehsil": row.get("tehsil"),
                    "district": _title(row.get("district", "")), "state": row.get("state"),
                    "pincode": pincode if pincode.isdigit() and len(pincode) == 6 else None, "pincode_match_level": level})
    return out


def _states(datasets: Datasets) -> dict[str, str]:
    states: dict[str, str] = {}
    for name in ("district_level_geocoded", "punjab_haryana_tehsils_geocoded", "csp_villages_geocoded"):
        for row in _rows(datasets, name):
            if row.get("state") and row.get("district"):
                states.setdefault(_norm(row["district"]), row["state"])
    for district, state in DISTRICT_STATE_HINTS.items():
        states.setdefault(_norm(district), state)
    return states


def districts_available(datasets: Datasets) -> list[dict]:
    """Every district with anchors or villages (AdMarketer PRIORITY_DISTRICTS), plus the excluded ones flagged."""
    anchors, villages, states = load_anchors(datasets), load_villages(datasets), _states(datasets)
    names: dict[str, str] = {}
    for item in anchors + villages:
        names.setdefault(_norm(item["district"]), item["district"])
    if not names:  # fresh install without imported reference data: AdMarketer's static list (no anchors → search on publish)
        names = {_norm(d): d for d in rules.STATIC_FALLBACK_DISTRICTS}
    for d in rules.EXCLUDED_DISTRICTS:
        names.setdefault(_norm(d), d)
    excluded = {_norm(d) for d in rules.EXCLUDED_DISTRICTS}
    out = []
    for key, name in sorted(names.items()):
        out.append({"name": name, "state": states.get(key), "anchor_count": sum(1 for a in anchors if _norm(a["district"]) == key),
                    "village_count": sum(1 for v in villages if _norm(v["district"]) == key),
                    "sources": sorted({a["source"] for a in anchors if _norm(a["district"]) == key}),
                    "excluded": key in excluded, "excluded_reason": "Saturated: 7 CSPs already there" if key in excluded else None})
    return out


def villages_for_district(datasets: Datasets, district: str) -> list[dict]:
    key = _norm(district)
    return [v for v in load_villages(datasets) if _norm(v["district"]) == key]


GENDER_CODES = {"male": [1], "female": [2], "all": []}


def resolve(datasets: Datasets, *, districts: list[str], village_codes: list[str], age_min: int, age_max: int, gender: str,
            daily_budget: float, schedule_days: int, placements: str) -> dict:
    """Targeting summary + the Meta ``targeting`` object it becomes (before any live-only district search)."""
    notes: list[str] = []
    excluded_keys = {_norm(d) for d in rules.EXCLUDED_DISTRICTS}
    wanted: list[str] = []
    removed: list[str] = []
    for d in districts:
        name = " ".join(str(d).split())
        if not name:
            continue
        if _norm(name) in excluded_keys:
            removed.append(name)
        elif _norm(name) not in {_norm(w) for w in wanted}:
            wanted.append(name)
    if removed:
        notes.append(f"Removed saturated district(s): {', '.join(removed)}.")

    wanted_keys = {_norm(d) for d in wanted}
    anchors = [a for a in load_anchors(datasets) if _norm(a["district"]) in wanted_keys]
    covered = {_norm(a["district"]) for a in anchors}

    by_code = {v["code"]: v for v in load_villages(datasets)}
    villages, unknown_codes = [], []
    for code in dict.fromkeys(village_codes):
        v = by_code.get(code)
        if v is None:
            unknown_codes.append(code)
        elif _norm(v["district"]) in excluded_keys:
            removed.append(v["village"] or code)
        else:
            villages.append(v)
    if unknown_codes:
        notes.append(f"{len(unknown_codes)} village code(s) were not found in the reference data and were ignored.")
    pincodes = sorted({v["pincode"] for v in villages if v["pincode"]})
    no_pin = [v for v in villages if not v["pincode"]]
    if no_pin:
        notes.append(f"{len(no_pin)} selected village(s) have no known PIN code and cannot be targeted on their own.")
    if any(v["pincode_match_level"] == "tehsil" for v in villages if v["pincode"]):
        notes.append("Some village PIN codes were matched at tehsil level (the tehsil's PIN code, not the village's own).")
    village_districts = {_norm(v["district"]) for v in villages if v["pincode"]}
    unresolved = [d for d in wanted if _norm(d) not in covered and _norm(d) not in village_districts]
    if unresolved:
        notes.append("No reference anchors for: " + ", ".join(unresolved) + ". A live publish looks these up with Meta's location "
                     "search (50 km around the district town); a dry run lists them unresolved.")

    geo_locations: dict = {}
    if anchors:
        geo_locations["custom_locations"] = [{"latitude": a["lat"], "longitude": a["lon"], "radius": a["radius_km"], "distance_unit": "kilometer"}
                                             for a in anchors]
    if pincodes:
        geo_locations["zips"] = [{"key": f"IN:{p}"} for p in pincodes]
    if not geo_locations and not unresolved:
        geo_locations["countries"] = ["IN"]
        notes.append("No district or village chosen: the ad would target all of India.")

    targeting = {"geo_locations": geo_locations, "age_min": age_min, "age_max": age_max,
                 # AdMarketer disabled Advantage Audience so Meta does not broaden beyond the chosen places.
                 "targeting_automation": {"advantage_audience": 0}}
    genders = GENDER_CODES.get(gender, [])
    if genders:
        targeting["genders"] = genders

    return {
        "districts": wanted, "removed": removed, "anchors": anchors, "villages": villages, "pincodes": pincodes,
        "unresolved_districts": unresolved, "age_min": age_min, "age_max": age_max, "gender": gender,
        "daily_budget": daily_budget, "schedule_days": schedule_days, "placements": placements,
        "meta_targeting": targeting, "notes": notes,
    }

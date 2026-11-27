"""Seed the Ads tables from AdMarketer's ``data/`` folder (the handover's reference data).

Imports (idempotent — running it again changes nothing):

* ``ad_targeted_pincodes.json`` → ``ads_targeting_records`` (missing campaigns only: a record written by a live sync is newer)
* ``ad_creatives.json`` + ``creatives/<ad_id>.<ext>`` → ``ads_creatives`` (blank fields filled, text never blanked) and
  ``ads_creative_images`` (added when missing, or replacing a stored thumbnail with a full-size picture)
* ``creative_labels.json`` → ``ads_creative_labels`` (missing hashes only: labels edited in the app win)
* ``ad_optimization.json`` → ``ads_optimization`` (missing campaigns only)
* reference lists (``csp_geocoded.json`` …) → ``ads_reference_datasets`` (replaced when the file differs)

The files are untrusted handover data: they are parsed as JSON only, shapes are checked, picture file names must be
``<digits>.<jpg|jpeg|png|webp|gif>`` inside ``creatives/`` and the bytes must carry an image signature.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AdsCreative, AdsCreativeImage, AdsCreativeLabel, AdsOptimization, AdsReferenceDataset, AdsTargetingRecord

REFERENCE_DATASETS = (
    "csp_geocoded", "punjab_haryana_tehsils_geocoded", "csp_villages_geocoded", "district_level_geocoded",
    "all_points_with_pincode", "csp_village_flags", "csp_villages_parsed", "punjab_haryana_villages",
)
MAX_JSON_BYTES = 20_000_000
MAX_IMAGE_BYTES = 5_000_000
_IMAGE_NAME = re.compile(r"^(\d{1,32})\.(jpg|jpeg|png|webp|gif)$", re.IGNORECASE)
_EXT_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif"}
_ID = re.compile(r"^[0-9]{1,32}$")


@dataclass
class ImportReport:
    counts: dict[str, dict[str, int]] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def add(self, table: str, key: str, n: int = 1) -> None:
        self.counts.setdefault(table, {"inserted": 0, "updated": 0, "unchanged": 0, "skipped": 0})[key] += n


def _read_json(path: Path) -> Any:
    if not path.is_file() or path.stat().st_size > MAX_JSON_BYTES:
        return None
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _s(value: Any, limit: int = 10_000) -> str:
    return (value if isinstance(value, str) else "" if value is None else str(value))[:limit]


def _opt(value: Any, limit: int = 64) -> str | None:
    return None if value is None or value == "" else _s(value, limit)


def _image_type(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    return None


def import_reference(db: Session, directory: Path) -> ImportReport:
    """Run the import into the workspace bound to ``db`` (``app.core.tenancy.bind_workspace``)."""
    directory = Path(directory)
    if not directory.is_dir():
        raise FileNotFoundError(f"{directory} is not a directory")
    report = ImportReport()
    _targeting(db, directory, report)
    _creatives(db, directory, report)
    _labels(db, directory, report)
    _optimization(db, directory, report)
    _datasets(db, directory, report)
    db.flush()
    return report


def _targeting(db: Session, directory: Path, report: ImportReport) -> None:
    data = _read_json(directory / "ad_targeted_pincodes.json")
    if not isinstance(data, dict):
        report.warnings.append("ad_targeted_pincodes.json missing or not an object")
        return
    existing = set(db.scalars(select(AdsTargetingRecord.campaign_id)))
    for cid, entry in data.items():
        if not _ID.match(str(cid)) or not isinstance(entry, dict):
            report.add("ads_targeting_records", "skipped")
            continue
        if cid in existing:
            report.add("ads_targeting_records", "unchanged")
            continue
        pins = [p for p in (entry.get("pincodes") or []) if isinstance(p, str) and re.fullmatch(r"\d{6}", p)]
        db.add(AdsTargetingRecord(
            campaign_id=cid, campaign_name=_opt(entry.get("campaign_name"), 2000), ad_name=_opt(entry.get("ad_name"), 2000),
            account_name=_opt(entry.get("account_name"), 300), pincodes=sorted(set(pins)),
            locations=[_s(x, 100_000) for x in (entry.get("locations") or []) if isinstance(x, str)],
            interests_behaviors=_s(entry.get("interests_behaviors")),
            setup=entry.get("setup") if isinstance(entry.get("setup"), dict) else {},
        ))
        existing.add(cid)
        report.add("ads_targeting_records", "inserted")


def _creatives(db: Session, directory: Path, report: ImportReport) -> None:
    data = _read_json(directory / "ad_creatives.json")
    if not isinstance(data, dict):
        report.warnings.append("ad_creatives.json missing or not an object")
        return
    rows = {c.ad_id: c for c in db.scalars(select(AdsCreative))}
    images = {i.ad_id: i for i in db.scalars(select(AdsCreativeImage))}
    image_dir = (directory / "creatives").resolve()
    for ad_id, entry in data.items():
        if not _ID.match(str(ad_id)) or not isinstance(entry, dict):
            report.add("ads_creatives", "skipped")
            continue
        row = rows.get(ad_id)
        values = {
            "campaign_id": _opt(entry.get("campaign_id")), "account_name": _opt(entry.get("account_name"), 300),
            "built": _opt(entry.get("built"), 10), "type": _s(entry.get("type") or "unknown", 16),
            "primary_text": _s(entry.get("primary_text")), "headline": _s(entry.get("headline")), "description": _s(entry.get("description")),
            "cta": _s(entry.get("cta"), 64), "image_hash": _s(entry.get("image_hash"), 128),
        }
        if row is None:
            row = AdsCreative(ad_id=ad_id, image_full=bool(entry.get("image_full")), **values)
            db.add(row)
            rows[ad_id] = row
            report.add("ads_creatives", "inserted")
        else:
            changed = False
            for key, value in values.items():  # fill blanks only; never blank existing text
                current = getattr(row, key)
                if value and (not current or (key == "type" and current == "unknown")) and value != current:
                    setattr(row, key, value)
                    changed = True
            report.add("ads_creatives", "updated" if changed else "unchanged")

        name = _s(entry.get("image_file"), 100)
        m = _IMAGE_NAME.match(name)
        if not name:
            continue
        if not m or m.group(1) != ad_id:
            report.add("ads_creative_images", "skipped")
            continue
        path = (image_dir / name).resolve()
        if path.parent != image_dir or not path.is_file() or path.stat().st_size > MAX_IMAGE_BYTES:
            report.add("ads_creative_images", "skipped")
            continue
        is_full = bool(entry.get("image_full"))
        existing = images.get(ad_id)
        if existing is not None and (existing.is_full or not is_full):
            report.add("ads_creative_images", "unchanged")
            continue
        blob = path.read_bytes()
        ctype = _image_type(blob)
        if ctype is None:
            report.add("ads_creative_images", "skipped")
            report.warnings.append(f"creatives/{name} is not a recognised image")
            continue
        if existing is None:
            db.add(AdsCreativeImage(ad_id=ad_id, content_type=ctype, byte_size=len(blob), is_full=is_full, data=blob))
            report.add("ads_creative_images", "inserted")
        else:
            existing.data, existing.content_type, existing.byte_size, existing.is_full = blob, ctype, len(blob), is_full
            report.add("ads_creative_images", "updated")
        row.image_full = bool(row.image_full or is_full)


def _labels(db: Session, directory: Path, report: ImportReport) -> None:
    data = _read_json(directory / "creative_labels.json")
    if not isinstance(data, dict):
        report.warnings.append("creative_labels.json missing or not an object")
        return
    existing = set(db.scalars(select(AdsCreativeLabel.image_hash)))
    for image_hash, entry in data.items():
        value = entry.get("image_type") if isinstance(entry, dict) else None
        if not re.fullmatch(r"[A-Za-z0-9_:-]{1,128}", str(image_hash)) or not isinstance(value, str) or not value.strip():
            report.add("ads_creative_labels", "skipped")
            continue
        if image_hash in existing:
            report.add("ads_creative_labels", "unchanged")
            continue
        db.add(AdsCreativeLabel(image_hash=image_hash, image_type=value.strip()[:300]))
        existing.add(image_hash)
        report.add("ads_creative_labels", "inserted")


def _optimization(db: Session, directory: Path, report: ImportReport) -> None:
    data = _read_json(directory / "ad_optimization.json")
    if not isinstance(data, dict):
        report.warnings.append("ad_optimization.json missing or not an object")
        return
    existing = set(db.scalars(select(AdsOptimization.campaign_id)))
    for cid, entry in data.items():
        if not _ID.match(str(cid)) or not isinstance(entry, dict):
            report.add("ads_optimization", "skipped")
            continue
        if cid in existing:
            report.add("ads_optimization", "unchanged")
            continue
        db.add(AdsOptimization(campaign_id=cid, **{k: _opt(entry.get(k), 64) for k in (
            "optimization_goal", "bid_strategy", "pixel_id", "custom_event_type", "daily_budget", "lifetime_budget")}))
        existing.add(cid)
        report.add("ads_optimization", "inserted")


def _datasets(db: Session, directory: Path, report: ImportReport) -> None:
    existing = {d.name: d for d in db.scalars(select(AdsReferenceDataset))}
    for name in REFERENCE_DATASETS:
        data = _read_json(directory / f"{name}.json")
        if not isinstance(data, list):
            report.warnings.append(f"{name}.json missing or not a list")
            continue
        row = existing.get(name)
        if row is None:
            db.add(AdsReferenceDataset(name=name, source_file=f"{name}.json", row_count=len(data), data=data))
            report.add("ads_reference_datasets", "inserted")
        elif row.data != data:
            row.data, row.row_count, row.source_file = data, len(data), f"{name}.json"
            report.add("ads_reference_datasets", "updated")
        else:
            report.add("ads_reference_datasets", "unchanged")

"""Ads module — core routes (Meta ads, lead-form leads, pictures, Excel exports, creative labels).

All mounted with ``require_auth`` (tenant-scoped; POST/PUT need the CSRF header):
    GET  /ads/status                         configured?, last sync, token expired, current job, counts
    POST /ads/sync                           ads:manage → 202 {jobId, status, kind, deduplicated}
    GET  /ads/summary                        totals (spend, leads, qualified leads, signups, cost per lead …)
    GET  /ads                                AdRow[]
    GET  /ads/leads?adId=&status=&q=         AdLead[] (masked without ads:leads); status = all|pincode|qualified|<qualification status>
    PATCH /ads/leads/{leadId}                write — {esafResponse: "yes"|"no"|null}; recomputes the status; audited
    GET  /ads/export.xlsx?from=&to=&filter=  ads:leads — all leads (AdMarketer download-all)
    GET  /ads/creative-labels                every picture hash with its hand label
    PUT  /ads/creative-labels/{imageHash}    write — set (or clear with null/"") a label
    GET  /ads/{adId}                         AdDetail
    GET  /ads/{adId}/leads                   AdLead[]
    GET  /ads/{adId}/image                   stored picture
    GET  /ads/{adId}/export.xlsx             ads:leads — this ad's leads

``{adId}`` is a catch-all path segment (validated as Meta's numeric id *after* authentication, so anonymous requests
always get 401): this router must stay included AFTER the reports / studio routers (``/ads/performance``,
``/ads/studio`` …) in ``app/api/router.py``, and its fixed paths are declared before ``/{adId}``.
"""

from __future__ import annotations

from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Path, Query, Request
from fastapi.responses import Response

from app.api.deps import DB, Ctx, commit, require
from app.schemas import ads as s
from app.services.ads import exports, queries, sync


router = APIRouter(prefix="/ads", tags=["ads"])

PRIVATE_NO_STORE = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}


@router.get("/status", response_model=s.AdsStatusOut, summary="Is Meta Ads configured, when did it last sync, is a sync running?")
def ads_status(request: Request, db: DB, ctx: Ctx):
    return queries.status(db, request.app.state.settings, ctx)


@router.post("/sync", response_model=s.AdsSyncOut, status_code=202,
             summary="Queue a Meta (or website-signup) sync; an already queued/running one is returned instead")
def ads_sync(request: Request, db: DB, ctx: Ctx, body: s.AdsSyncIn | None = None, _perm=require("ads:manage")):
    settings = request.app.state.settings
    kind = body.kind if body else "meta"
    sync.check_configured(settings, kind)
    if sync.resolve_workspace_id(db, settings) != ctx.workspace_id:
        raise sync.AdsWorkspaceError("The Meta Ads credentials on this server belong to another workspace.")
    dispatcher = getattr(request.app.state, "job_dispatcher", None)
    if dispatcher is None:
        raise sync.AdsSyncUnavailableError()
    result = sync.enqueue(db, settings, ctx.workspace_id, kind=kind, trigger="manual", member_id=ctx.member_id)
    db.commit()
    if result.created:
        dispatcher(result.run.id, 0.0)
    return s.AdsSyncOut(job_id=result.run.id, status=result.run.status, kind=result.run.kind, deduplicated=not result.created)


@router.get("/summary", response_model=s.AdsSummaryOut, summary="Totals across every stored ad")
def ads_summary(db: DB):
    return queries.summary(db)


@router.get("", response_model=list[s.AdRowOut], summary="Every stored ad, newest first")
def list_ads(db: DB):
    return queries.list_ads(db)


@router.get("/leads", response_model=list[s.AdLeadOut], summary="Lead-form leads across ads (names/phones/answers need ads:leads)")
def list_leads(db: DB, ctx: Ctx, ad_id: str | None = Query(None, alias="adId", pattern=r"^[0-9]{1,32}$"),
               status: s.LeadStatusFilter = "all", q: str | None = Query(None, max_length=100)):
    return queries.list_leads(db, ctx, ad_id=ad_id, status=status, q=q)


@router.patch("/leads/{lead_id}", response_model=s.AdLeadOut, summary="Record the lead's answer to the ESAF pitch (recomputes the status)")
def update_lead(request: Request, db: DB, ctx: Ctx, body: s.AdLeadPatchIn, lead_id: str = Path(pattern=r"^[0-9]{1,32}$"),
                _perm=require("write")):
    return commit(db, queries.set_lead_esaf(db, request.app.state.settings, ctx, lead_id, body.esaf_response))


def _xlsx(content: bytes, filename: str) -> Response:
    return Response(content, media_type=exports.XLSX_MEDIA_TYPE, headers={
        **PRIVATE_NO_STORE, "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{quote(filename)}"})


@router.get("/export.xlsx", summary="Excel download of all leads (optionally a date window and qualified/pincode filter)",
            response_class=Response)
def export_all(db: DB, from_: str = Query("", alias="from", max_length=10), to: str = Query("", max_length=10),
               filter: Literal["", "qualified", "pincode", "sbi_strong", "esaf_strong", "esaf_pitch", "needs_info", "not_qualified"] = "", _perm=require("ads:leads")):  # noqa: A002
    return _xlsx(*exports.all_leads_workbook(db, from_date=from_, to_date=to, lead_filter=filter))


@router.get("/creative-labels", response_model=list[s.CreativeLabelOut], summary="Pictures and their hand labels")
def creative_labels(db: DB):
    return queries.creative_labels(db)


@router.put("/creative-labels/{image_hash}", response_model=s.CreativeLabelOut, summary="Set or clear a picture's label")
def set_creative_label(db: DB, body: s.CreativeLabelIn, image_hash: str = Path(pattern=r"^[A-Za-z0-9_:-]{1,128}$"),
                       _perm=require("write")):
    return commit(db, queries.set_creative_label(db, image_hash, body.image_type))


def AdId():  # noqa: N802
    return Path(pattern=r"^[0-9]{1,32}$")


@router.get("/{ad_id}", response_model=s.AdDetailOut, summary="One ad with breakdowns and full targeting")
def get_ad(db: DB, ad_id: str = AdId()):
    return queries.ad_detail(db, ad_id)


@router.get("/{ad_id}/leads", response_model=list[s.AdLeadOut], summary="Leads assigned to one ad")
def get_ad_leads(db: DB, ctx: Ctx, ad_id: str = AdId()):
    return queries.ad_leads(db, ctx, ad_id)


@router.get("/{ad_id}/image", summary="The ad's stored picture", response_class=Response)
def get_ad_image(db: DB, ad_id: str = AdId()):
    data, content_type = queries.ad_image(db, ad_id)
    return Response(data, media_type=content_type, headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"})


@router.get("/{ad_id}/export.xlsx", summary="Excel download of one ad's leads", response_class=Response)
def export_ad(db: DB, ad_id: str = AdId(), _perm=require("ads:leads")):
    return _xlsx(*exports.ad_leads_workbook(db, ad_id))

from fastapi import APIRouter, Depends

from app.api.deps import require_auth
from app.api.routes import ai, auth, core, engagement, integrations, ops, publishing

api_router = APIRouter()

# Public + self-protecting auth routes (login, invitation acceptance, /auth/me …).
api_router.include_router(auth.router)
api_router.include_router(auth.platform)
# Instagram OAuth callback + Meta signed callbacks: no session dependency (they validate state / signatures).
api_router.include_router(integrations.public)
api_router.include_router(publishing.public)  # pictures Meta downloads while a post is published

# Every workspace route requires a valid session. Mounting the dependency here (not per route) means a
# newly added route cannot accidentally be served anonymously; per-route ``require(...)`` adds role checks.
for router in [*core.routers, *engagement.routers, integrations.router, integrations.sync_jobs, publishing.router, ai.ai, ai.analytics_router, ops.ops]:
    api_router.include_router(router, dependencies=[Depends(require_auth)])

# Ads reports (/ads/performance, /ads/experiments, /ads/signups, /ads/overview). Keep this BEFORE any router with an
# ``/ads/{adId}`` route, or that path parameter would capture these fixed paths.
from app.api.routes import ads_reports  # noqa: E402

api_router.include_router(ads_reports.router, dependencies=[Depends(require_auth)])

# Ad Studio (/ads/studio/...). Also before any ``/ads/{adId}`` router.
from app.api.routes import ads_studio  # noqa: E402

api_router.include_router(ads_studio.router, dependencies=[Depends(require_auth)])

# Ads core (/ads, /ads/status, /ads/{adId} …). Must stay LAST of the /ads routers: ``/ads/{adId}`` is a catch-all
# segment and would otherwise shadow /ads/performance, /ads/studio/… .
from app.api.routes import ads  # noqa: E402

api_router.include_router(ads.router, dependencies=[Depends(require_auth)])

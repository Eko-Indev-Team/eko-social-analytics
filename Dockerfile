# syntax=docker/dockerfile:1.7
# Eko SocialBoard — one Dockerfile, two images (build from the repository root):
#
#   docker build --target api -t eko-social-analytics-api .   # FastAPI API + Celery worker + beat + migration job
#   docker build --target web -t eko-social-analytics-web .   # React app on unprivileged nginx, proxies /api to `api`
#
# docker-compose.yml builds both; .github/workflows/deploy.yml builds and pushes both to GHCR.
# No secrets are baked in: all configuration comes from the environment at run time (see .env.example).

# ------------------------------------------------------------------------------------------------ backend (api)
FROM python:3.12-slim AS api-build
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /build
COPY backend/requirements.txt .
RUN pip wheel --wheel-dir /wheels -r requirements.txt

FROM python:3.12-slim AS api
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    APP_ENV=production \
    LOG_FORMAT=json \
    WEB_CONCURRENCY=2
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=api-build /wheels /wheels
RUN pip install --no-index --find-links=/wheels /wheels/*.whl && rm -rf /wheels
COPY --chown=app:app backend/alembic.ini ./
COPY --chown=app:app backend/app ./app
COPY --chown=app:app backend/migrations ./migrations
COPY --chown=app:app backend/scripts ./scripts
COPY --chown=app:app backend/evaluation ./evaluation
USER app
EXPOSE 8000
# Liveness only (does not touch the database); readiness is /ready.
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD python -c "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status == 200 else 1)"
# --proxy-headers + FORWARDED_ALLOW_IPS (set in compose) make client IPs/scheme come from the trusted reverse proxy.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--no-server-header", "--timeout-graceful-shutdown", "20"]

# ------------------------------------------------------------------------------------------------ frontend (web)
FROM node:20-alpine AS web-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ .
ARG VITE_DATA_SOURCE=api
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_BASE_PATH=/
ENV VITE_DATA_SOURCE=${VITE_DATA_SOURCE} VITE_API_BASE_URL=${VITE_API_BASE_URL} VITE_BASE_PATH=${VITE_BASE_PATH}
RUN if [ "$VITE_DATA_SOURCE" = "demo" ]; then npm run build; else npm run build:api; fi

FROM nginxinc/nginx-unprivileged:1.27-alpine AS web
COPY frontend/deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=web-build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

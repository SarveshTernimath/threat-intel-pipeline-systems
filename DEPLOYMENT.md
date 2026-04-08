# Deployment Guide (Safe, Fast Path)

This project can be deployed in a production-friendly split:

- Frontend: Vercel (Next.js)
- API + Worker: Render (or Railway/Fly)
- Redis + Elasticsearch: Managed cloud services

## 1) Recommended Cloud Topology

- `dashboard_ts` -> Vercel
- `api/server.py` -> Render Web Service
- `workers/worker.go` -> Render Background Worker
- Redis -> Upstash Redis
- Elasticsearch -> Elastic Cloud

## 2) Required Environment Variables

- `ELASTICSEARCH_URL` -> your Elastic Cloud endpoint
- `REDIS_URL` -> your managed Redis URL (**use `rediss://` for TLS/Upstash**)
- `OTX_API_KEY` -> AlienVault key

Frontend (`dashboard_ts`) only:
- Set `BASE_URL` usage to backend URL strategy you choose for prod.

## 3) Deployment Order

1. Provision Redis + Elasticsearch first.
2. Deploy API with env vars and confirm `/search`.
3. Deploy worker with same env vars and verify indexing logs.
4. Deploy frontend and point it to API URL.
5. Run smoke checks: search, queue drain, index growth, UI query.

## 4) Production Safety Checklist

- Health checks enabled for API service.
- Worker auto-restart enabled.
- Secrets configured only in platform secret manager (never in git).
- Log retention enabled for API and worker.
- Rollback strategy: keep last known-good release in each service.

## 5) Quick Verify Commands (post-deploy)

- API: `GET /search?keyword=attack&limit=5`
- ES count: `GET /threats/_count`
- Frontend: load dashboard and run search
- Worker: confirm repeated "Successfully indexed threat" logs

## 7) Important Format Notes (prevents common breakage)

- Do not set `REDIS_URL` as `redis-cli --tls -u ...` command text.
- Set only the URL value, example:
  - `REDIS_URL=rediss://default:<password>@<host>:6379`
- Elastic Cloud URL should stay HTTPS with credentials (or provider secrets):
  - `ELASTICSEARCH_URL=https://user:pass@your-deployment.es.region.aws.elastic-cloud.com`

## 6) Fast Hardening (first 48h after deploy)

- Add uptime checks for API and frontend.
- Add alert when queue length is continuously growing.
- Add alert when API returns repeated 5xx.

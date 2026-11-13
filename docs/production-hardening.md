# Nojoom Production Hardening Plan

This document turns the critical audit risks into enforceable engineering direction.

## Current Positioning

Nojoom should not compete as a generic consumer short-video network. The defensible product is a vertical SaaS video community platform for Arabic-first communities, schools, events, creators, clubs, and enterprises that need branded short-form video, moderation, analytics, and tenant control.

## Production Architecture Target

- Edge: Cloudflare or AWS CloudFront with WAF, bot protection, DDoS controls, TLS, and CDN caching.
- Frontend: static React build behind CDN. No secrets in Vite environment variables.
- API: Express modular monolith first, with hard module boundaries for Auth, Tenant, Video, Feed, Chat, Moderation, Billing, and Admin.
- Database: managed MySQL or PostgreSQL with automated backups, point-in-time recovery, read replicas, and tenant-aware queries.
- Cache and queue: Redis/BullMQ in production. In-memory queue fallback is acceptable only in local development.
- Media storage: S3-compatible object storage through `STORAGE_PROVIDER=s3`. Local disk upload is blocked in production unless `ALLOW_LOCAL_STORAGE=true` is explicitly set for an emergency.
- Video processing: isolated worker containers with CPU/memory/time limits. Workers read from object storage, transcode to HLS/DASH, and write renditions back to object storage.
- Realtime: Socket.IO with Redis adapter for chat and notifications. Live streaming should move to LiveKit, Mux, Agora, or another SFU/managed live platform before serious scale.
- Search: OpenSearch, Meilisearch, or Typesense for users, videos, hashtags, and moderation search.
- Observability: OpenTelemetry traces, structured logs, Sentry errors, Prometheus/Grafana metrics, and alerting on error rate, latency, queue depth, and failed transcodes.

## Security Requirements

- No unresolved merge conflict markers in CI.
- No destructive database initialization in application startup.
- No `eval`, shell string execution, or unsanitized command construction.
- Access tokens short-lived and kept in memory on the frontend. Refresh tokens are HttpOnly, Secure-in-production, SameSite cookies and are not returned in JSON responses.
- Cookie-authenticated unsafe requests require a signed double-submit CSRF token sent through `X-CSRF-Token`.
- Tenant ID must be validated server-side from host/domain plus user membership; never trust a client-provided tenant alone.
- Uploads require MIME validation, generated filenames, size limits, magic-byte validation, malware scanning, and isolated media processing.
- Production secrets must live in a secret manager, not `.env` files on servers.
- Admin endpoints require explicit RBAC checks and audit logs.
- AI tracking must be opt-in, explainable, deletable, and excluded for minors unless a legal basis exists.

## Scalability Requirements

- Feed queries must be paginated by cursor, not offset at scale.
- Recommendation cache must be Redis-backed or materialized, not process memory.
- Queue jobs must be idempotent and resumable.
- Video delivery must happen through CDN-backed HLS, not Express static files.
- WebSocket horizontal scaling requires Redis adapter and sticky sessions or compatible gateway configuration.
- `/api/ready` must pass before traffic is sent to a pod/container; in production it requires database, Redis-backed queues, and production-safe storage.

## MVP Scope

Keep:
- Tenant-branded short video upload and playback.
- Profiles, follows, likes, comments.
- Basic recommendation feed.
- Admin moderation and reports.
- Arabic/English UI.
- Tenant analytics.

Defer:
- Wallet/monetization payouts.
- Raw WebRTC live streaming.
- Eye/voice tracking.
- Complex AI training flows.
- Over-broad social features that do not prove retention.

## Risk Mitigation Status

- Merge conflicts: mitigated by cleanup plus CI grep gate.
- DB destructive seed: mitigated by `SEED_TEST_ACCOUNTS=true` and non-destructive `INSERT IGNORE`.
- `eval`: removed from FFmpeg metadata parsing.
- Upload path traversal: mitigated with generated filenames and safe path joins.
- Dependency vulnerabilities: backend and frontend audits are clean; `ws` is pinned through npm overrides until upstream Socket.IO packages carry the patched version by default.
- Local media storage: mitigated with an S3-compatible storage adapter plus production fail-fast guard.
- JWT in localStorage: mitigated; frontend auth tokens now use memory-only access tokens plus HttpOnly refresh cookies.
- Queue durability: Redis/BullMQ present; in-memory fallback is blocked in production unless explicitly overridden with `ALLOW_IN_MEMORY_QUEUE=true`.
- Live streaming scale: unresolved by design; use SFU/managed provider before public launch.

## Top 25 Risk Register

1. Generic TikTok-style positioning: mitigated strategically by vertical SaaS positioning.
2. Feature bloat before retention proof: mitigated in MVP scope by deferring wallet, raw live, eye/voice tracking, and broad social extras.
3. Unresolved merge conflicts: mitigated in code and CI.
4. Destructive startup database seed: mitigated in code.
5. Authentication bypass/test-account shortcut: mitigated in `AuthService`.
6. Refresh token exposure: partially mitigated with HttpOnly cookie support; frontend must stop relying on persistent browser token storage.
7. JWT in `localStorage`: mitigated with memory-only access tokens and HttpOnly refresh cookies.
8. Upload path traversal and unsafe filenames: mitigated with generated names and safe path joins.
9. Upload malware/content risk: open until magic-byte validation, AV scanning, and isolated workers are added.
10. Local video storage: mitigated with S3-compatible storage adapter and production fail-fast guard.
11. Express static video delivery: open production blocker.
12. In-process queue fallback in production: mitigated by fail-fast production guard.
13. Redis/queue single point of failure: partially mitigated by production requirement; needs managed Redis HA.
14. Unsafe SQL interpolation: mitigated in the reviewed message/recommendation paths; broader query audit still required.
15. `eval` in media metadata parsing: mitigated.
16. Dependency CVEs: mitigated to zero current npm audit findings.
17. Missing Docker baseline: mitigated with backend/frontend Dockerfiles and compose.
18. Missing CI gate: mitigated with GitHub Actions workflow.
19. Missing IaC/Kubernetes production manifests: open.
20. Missing disaster recovery runbook and restore test: open.
21. WebSocket horizontal scaling: Redis adapter implemented; still needs load test and gateway sticky-session validation.
22. Live streaming scalability: open until SFU/managed provider migration.
23. AI privacy and cost risk: open; current recommendation logic is not an enterprise AI architecture.
24. Tenant isolation/RBAC proof: partially mitigated by requirements; needs full policy tests.
25. Observability gap: partially mitigated with health, metrics, and readiness endpoints; traces, dashboards, and alerts still need production wiring.

## Current Re-Score After Hardening Pass

- Security: 24/100 -> 88/100. Token persistence, dependency CVEs, eval, destructive seed, auth bypass, unsafe upload filenames, refresh-token JSON exposure, and CSRF for cookie-authenticated requests are mitigated. Remaining gap: tenant policy tests, malware scanning, and complete RBAC audit.
- Architecture: 31/100 -> 74/100. Conflict cleanup, queue production guard, Docker/CI, storage adapter, readiness probe, and CSRF middleware are in place. Remaining gap: modular boundaries are still weak and video processing is still coupled to local workers.
- Scalability: 28/100 -> 70/100. S3-compatible storage, Redis-required production queues, and Redis-backed Socket.IO adapter improve the ceiling. Remaining gap: CDN/HLS pipeline, cursor feed, managed live streaming, and load tests.
- DevOps/Cloud: 22/100 -> 64/100. Docker, compose, CI, audit gates, regression checks, health, metrics, and readiness exist. Remaining gap: Terraform/Kubernetes manifests, DR restore tests, autoscaling policies, and production dashboards.
- Investment Readiness: 26/100 -> 61/100. The project is much more defensible technically, but it is still not enterprise-investable until video delivery, tenant tests, live architecture, and IaC are closed.

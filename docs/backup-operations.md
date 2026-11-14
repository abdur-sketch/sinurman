# SINURMAN backup operations

## Current failure mode

The application exposes `POST /api/maintenance/backup` for an external
scheduler. It requires the `CRON_SECRET` bearer token and is intentionally
fail-closed when the secret is missing or invalid. App Hosting does not execute
this route on a schedule by itself. The Admin dashboard also triggers an
opportunistic backup after an Admin login, but that is not a replacement for a
durable scheduler.

## Required scheduler configuration

Use an existing Cloud Scheduler integration (or an already-approved scheduler)
to call the production endpoint once per day. The application considers a
backup due after 18 hours, leaving margin for a daily run to remain within the
26-hour freshness SLA:

```text
POST https://sinurman-2026.web.app/api/maintenance/backup
Authorization: Bearer <CRON_SECRET>
```

Keep the secret in Secret Manager. Do not put it in source control, browser
code, logs, or a query string. A `200` response with `skipped: true` is
expected only when the current marker is still within the 18-hour interval.

## Monitoring

`GET /api/health` reports `backupStatus`, `backupAgeHours`, and
`backupWarning`. The operational SLA is 26 hours. Alert when the status is
`stale` or `missing`; this is a backup warning, not an application data reset
or an instruction to delete older backups.

## Validation and restore rehearsal

Every stored backup has a manifest and SHA-256 checksum. Validate the manifest,
checksum, size, table coverage, and JSON shape before attempting a restore.
Restore rehearsals must use an isolated QA database only. Never send
`confirm: "PULIHKAN"` to production as part of an automated health check.

## Safe production rollout

The health-check optimization in this release removes the expensive schema
bootstrap from the liveness/readiness path. It still performs a lightweight
read from the `users` table and a Storage marker read, both with a 3-second
timeout. Schema migrations remain on the normal application initialization
path.

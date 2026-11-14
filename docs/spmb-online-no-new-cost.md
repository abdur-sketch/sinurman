# SPMB online from home — no additional cloud resources authorized

Decision: The owner wants applicants to take SPMB tests remotely through HTTPS while **prioritizing existing/free allowances**. No new paid resources, project, billing-plan changes, deployment, or production data changes are authorized.

## Current facts (2026-11-11)

- Existing public Firebase Hosting: `sinurman-2026` -> Cloud Run `sinurman`; the live URL is `https://sinurman-2026.web.app`.
- This existing production route **is not a staging environment**. Do not deploy PR #1 to it as a shortcut.
- Proposed same-project staging needs a separate named Firestore database, bucket, service account, Cloud Run service and Hosting site; provisioning them can create charges.
- The Firebase Work audit found vulnerable dependencies, unverified runtime/OTP behavior and failing GitHub Actions. Until independently cleared, **NO-GO for any remote test deployment or real applicant use**.
- A local emulator can test flows at no cloud cost but is not a suitable public examination endpoint.

## Lowest incremental-cost safe route

1. Complete the three security blockers on PR #1: fail-closed runtime, actual mock OTP behavior, and npm dependency/lockfile remediation. Verify `npm audit --omit=dev`, `npm ci`, TypeScript, lint, build, API integration tests and CI at the exact commit. A CI failure is not a pass.
2. Perform fully local tests with synthetic admissions and Firebase emulators, including question creation, timer, submission retries, scoring, publication permissions, and applicant isolation. No cloud resource required.
3. Before any internet exposure, select ONE approved path:
   - **Existing production release**: only after explicit owner release approval, successful security/UAT, production backup, migration and rollback review. This avoids adding staging services, but UAT cannot be safely performed against live applicant records. It is **not** a substitute for staging.
   - **Isolated public staging**: owner approves provisioning of the minimum necessary resources after a cost estimate. It provides safer remote UAT but may incur incremental charges even when idle.
4. Confirm internet accessibility, TLS, mobile Chrome/Safari, rate limits, OTP channel cost, availability under concurrent exams, monitoring, incident response and rollbacks before inviting applicants.
5. Monitor existing Firebase/GCP billing and set budget alerts if authorized; alerts **do not** cap or automatically stop charges.

## Non-negotiable guardrails

- Never use a generic `firebase deploy` with the production `firebase.json` for staging.
- Never point a test backend to production `(default)` Firestore or production Storage.
- Never share production Admin SDK identity with staging.
- Never enable mock OTP in production or expose a fixed test OTP to real applicants.
- Never claim a public URL is ready without an actual deployed release and end-to-end validation.
- No new Firebase/GCP resource or billable deployment without owner approval.

## Acceptance criteria for real applicants

- [ ] No critical/high exploitable runtime dependencies, or formally assessed mitigations approved.
- [ ] Production CI green for exact candidate SHA.
- [ ] Authorization/OTP/session/security integration tests green.
- [ ] Data backup and rollback rehearsal evidenced.
- [ ] At least one Android Chrome and iPhone Safari real-device end-to-end run.
- [ ] Public HTTPS endpoint verified, no score/key leak before publication.
- [ ] Owner explicitly approves release and any potential costs.

**Current status: NOT READY FOR REAL APPLICANTS.**

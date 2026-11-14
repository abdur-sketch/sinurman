# SPMB Staging & UAT — release gate

Status: **NO-GO production**. This document does not authorize a deployment or cloud resource creation.

## Verified inventory (owner's Firebase Work audit, 2026-11-11)

The existing project `sinurman-2026` contains **only production resources**: Hosting `sinurman-2026`, Cloud Run `sinurman`, Firestore `(default)`, bucket `sinurman-2026.firebasestorage.app`, and a shared Firebase Auth user pool. Billing is on, but the owner has **not approved provisioning of new billable resources** in the specific Work handoff. All staging resource names below remain proposed and uncreated.

## Same-project staging resource design

| Resource | Production (must remain unchanged) | Staging target (NOT YET CREATED) |
| --- | --- | --- |
| Firebase project | `sinurman-2026` | same project |
| Hosting site | `sinurman-2026` | `sinurman-2026-staging` |
| Cloud Run service | `sinurman` | `sinurman-spmb-staging` in `asia-southeast1` |
| Firestore | `(default)` | named database `spmb-staging` |
| Storage | `sinurman-2026.firebasestorage.app` | dedicated bucket `sinurman-2026-spmb-staging` (availability to be checked) |
| Service account | production App Hosting SA | new `sinurman-spmb-staging` runtime SA, with narrowly scoped access |
| Secrets | production `CRON_SECRET` | staging-specific secret versions/names, never reuse production secret |
| Firebase Auth | shared project Auth pool | shared by design, **not isolated** |
| OTP | real external provider | mock OTP in UAT (no real WhatsApp messages by default) |

**Security limitation:** Resource boundaries within one Firebase/GCP project are weaker than separate projects because project-level IAM, billing, quotas, some APIs and Firebase Authentication can remain shared. Firebase Admin SDK bypasses Firestore/Storage Security Rules and uses IAM; deny-all client rules are not enough. For Firestore, scope `roles/datastore.user` to the staging database with a correctly reviewed IAM condition, and verify no inherited broad roles. For Storage, use bucket-scoped permissions with Uniform Bucket-Level Access and Public Access Prevention. The dedicated Cloud Run service must execute as the dedicated restricted service account, not the production App Hosting identity. Security review must explicitly test that this identity **cannot** read/write production data.

**Auth decision:** Candidate SPMB pilot uses the application's own OTP in a staging database with mock delivery, and admin login can use the shared Firebase Auth user pool. No creation/deletion or enumeration of production users is permitted in staging UAT. Full Auth isolation requires Identity Platform tenancy or a separate project; do not describe shared Auth as isolated.

## Code safeguards on the feature branch

- `lib/firebase/runtime-isolation.mjs` checks `SINURMAN_RUNTIME_ENV=staging`, exact project, named database, bucket, and (if provided) the `K_SERVICE` runtime service name. It rejects staging service account JSON, emulator flags and any fallback to the default production Firestore/bucket.
- `lib/firebase/admin.ts` uses `getFirestore(app, "spmb-staging")` when in staging; existing production defaults are unchanged. Named Firestore selection through Admin SDK is marked *preview* in its documentation: validate this SDK/version in staging before relying on it.
- `firebase.staging.json` is a standalone Hosting-only config. It does **not** provision Cloud Run, Firestore, bucket, secrets or service accounts.
- `scripts/spmb-staging-preflight.mjs` is a read-only guard whose `*_CONFIRMED=isolated` variables are **self-attestations**, not independently verified IAM evidence.
- `tests/spmb-staging-isolation.test.mjs` adds runtime target and preflight tests. Do not claim they pass until the exact SHA has been executed in CI/local.

## Cloud provisioning gate — NOT YET AUTHORIZED OR EXECUTED

Before any provisioning, record owner approval for potential incremental billing, quotas, proposed resource IDs and regions. Prepare and review these steps in Firebase Work:

1. Create an empty named Firestore database `spmb-staging` with delete protection, deny-all client rules and an agreed backup/restore plan. Do not copy actual santri/pendaftar data.
2. Create a new bucket `sinurman-2026-spmb-staging`, with Uniform Bucket-Level Access, Public Access Prevention, deny-all Firebase client rules (where applicable), and soft-delete.
3. Create dedicated Cloud Run service account and conditionally scoped database IAM, bucket-level IAM, and scoped staging secrets. Verify it has **no** project-level Owner/Editor/Firebase Admin/Storage Admin/Datastore broad roles inherited.
4. Create the staging Cloud Run service with its own service identity, staging environment variables and tested deployment artifact; verify it cannot call production Firestore or Storage.
5. Create the independent Hosting site, connect only the staging Cloud Run service. Register the staging Firebase Web App and its required authorized domain without mutating production app settings unexpectedly.
6. Review costs and IAM policies again before any hosting/backend deployment; deploy only to explicit staging targets after authorized approval.

Read-only cloud verification examples (not provisioning):
```bash
gcloud firestore databases describe --database=spmb-staging --project=sinurman-2026
gcloud storage buckets describe gs://sinurman-2026-spmb-staging
gcloud run services describe sinurman-spmb-staging --region=asia-southeast1 --project=sinurman-2026
firebase hosting:sites:list --project sinurman-2026
```

## Read-only local configuration preflight

**Only after verifying separate cloud resources** and the environment bindings, run:

```bash
FIREBASE_RUNTIME=true \
SINURMAN_RUNTIME_ENV=staging \
K_SERVICE=sinurman-spmb-staging \
FIREBASE_PROJECT_ID=sinurman-2026 \
FIREBASE_FIRESTORE_DATABASE_ID=spmb-staging \
FIREBASE_STORAGE_BUCKET=sinurman-2026-spmb-staging \
SINURMAN_STAGING_DATABASE_CONFIRMED=isolated \
SINURMAN_STAGING_BUCKET_CONFIRMED=isolated \
SINURMAN_STAGING_SECRETS_CONFIRMED=isolated \
SINURMAN_STAGING_SERVICE_CONFIRMED=isolated \
SINURMAN_STAGING_SITE_CONFIRMED=isolated \
SINURMAN_STAGING_OTP_MODE=mock \
node scripts/spmb-staging-preflight.mjs
```

This script only validates explicit configuration and attestations. It cannot prove actual cloud separation or permission boundaries. **Never execute a generic `firebase deploy` using the default `firebase.json`**, since that file targets production. The separate `firebase.staging.json` is only for use in a separately reviewed staging-specific deployment plan.

## UAT evidence matrix

Record date, exact build SHA, tester, browser/OS, staging URL, test ID, PASS/FAIL/BLOCKED, screenshots/logs, and defect IDs. Do not mark PASS based on code inspection.

| ID | Scenario | Expected result |
| --- | --- | --- |
| A01 | Admin creates questions | Stored in staging only |
| A02 | Valid CSV up to 500 questions | Valid import, preserved snapshots |
| A03 | Invalid/duplicate/>500 rows/formula cells | Safely rejected or escaped |
| A04 | Assign synthetic SMP IT/SMK applicants | Proper scope and instructions |
| P01 | Applicant mock OTP | Only own assignment accessible |
| P02 | Start/refresh test | Server deadline and answers consistent |
| P03 | Submit/retry/expired request | Exactly one final submission |
| P04 | Result before publication | No score/key leak |
| A05 | Inspect/print answer details | Correct per-question data |
| A06 | Concurrent publication | One valid publication + audit |
| P05 | Result after publication | Authorized published result only |
| S01 | Unauthorized admin API | 401/403, no sensitive data |
| S02 | Cross-applicant data request | Rejected |
| S03 | Staging service account reads production Firestore/bucket | **Permission denied** |
| S04 | Staging runtime resolves named Firestore and dedicated bucket | Confirmed, no fallback |
| M01 | Chrome desktop | Full workflow |
| M02 | Android Chrome | Touch/timer/submit/result |
| M03 | iPhone Safari | Touch/timer/submit/result |
| W01 | Authorized WhatsApp test number (optional pilot) | OTP delivery and expiry, after separate permission |
| R01 | Staging rollback/restore rehearsal | Successful with evidence |

## Release decision

Run TypeScript, ESLint, Firebase build, tests, and Git diff checks on the exact candidate commit. GitHub Actions workflow billing failures are BLOCKED/FAIL, never PASS. Physical device tests cannot be replaced with desktop emulation. Keep PR #1 **DRAFT** and production **NO-GO** until cloud isolation, security controls, UAT, and explicit production release approval are all verified.

## Security blockers found in Work audit (2026-11-11)

- **Fixed in code, pending independent verification:** Cloud Run `K_SERVICE=sinurman-spmb-staging` now refuses to enter implicit production mode if `SINURMAN_RUNTIME_ENV` is missing. The staging runtime also requires the explicit named database and bucket.
- **Implemented in code, pending integration test:** `/api/spmb/track/start` uses a staging-only six-digit `SINURMAN_STAGING_TEST_OTP_CODE` supplied through a dedicated staging secret, accepts only synthetic `STG-` registration numbers, and never calls the WhatsApp delivery function in staging. The code must not be printed in responses or logs. Rate limiting and five-minute OTP expiry remain in force. Remove/rotate the secret after UAT; never store it in Git.
- **Unresolved security release blocker:** The installed lockfile contains known-vulnerable runtime dependencies (`next@16.2.12`, `sharp@0.35.2` per Work audit). Update both the dependency manifest **and regenerated lockfile** using `npm install next@^16.4.1` and a patched Sharp version (`>=0.35.5`), then run `npm ci`, production dependency audit, TypeScript, ESLint, build and UAT against the resulting exact SHA. Do not hand-edit npm integrity hashes or approve deployment with a stale lockfile.
- **Verification gap:** The preceding code changes have not yet been executed through a green GitHub Actions CI, and the OTP implementation has not yet been exercised against real isolated staging resources. Tests that inspect source strings do not prove behavior.
- **Cost approval:** Firebase Work estimated low-load costs of US$0–3/month and recommended a US$10/month alert. These are not hard spending caps. Provisioning resource creation requires the owner's explicit cost approval.

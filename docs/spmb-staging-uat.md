# SPMB Staging & UAT — release gate

Status: **NO-GO production** until evidence below is recorded. This document does not authorize a deployment.

## Safety prerequisites — same Firebase project

1. Use existing Firebase project `sinurman-2026`, **without modifying its production site or Cloud Run service**.
2. Proposed staging resources inside that project: Hosting site `sinurman-2026-staging`, Cloud Run service `sinurman-staging` in `asia-southeast1`. These are **names in a configuration file**, not proof of resource creation.
3. Staging needs its **own database**, application secrets, runtime identity, data access rules, and mock OTP. Sharing a Firebase project means project-wide IAM, billing, quotas and some services remain shared; this is weaker isolation than a separate project.
4. Review all Firebase Auth, Firestore, Storage and backend access: if production and staging use the same default Auth/Firestore resources, do not run destructive or state-changing UAT. A second Hosting site does not isolate them.
5. Confirm a backup/rollback plan and use synthetic applicant data only.
6. The default `firebase.json` targets production. **Never deploy staging with that default file.** Use only the reviewed `firebase.staging.json` after all safety gates.
7. Read-only preflight (manual confirmations must be based on verified resource configuration):

```bash
SINURMAN_STAGING_PROJECT=sinurman-2026 \
SINURMAN_STAGING_DATABASE_CONFIRMED=isolated \
SINURMAN_STAGING_SECRETS_CONFIRMED=isolated \
SINURMAN_STAGING_SERVICE_CONFIRMED=isolated \
SINURMAN_STAGING_SITE_CONFIRMED=isolated \
SINURMAN_STAGING_OTP_MODE=mock \
node scripts/spmb-staging-preflight.mjs
```

8. Only after verified separation, approved costs, authorized credentials, and successful build should an operator review the explicit target command: `firebase deploy --project sinurman-2026 --config firebase.staging.json --only hosting`. **This command is documentation, not authorization to execute it.** It assumes staging Cloud Run service is independently provisioned and configured; Hosting deploy alone does not deploy the backend.
9. Project-level security boundaries cannot be guaranteed by this preflight script. If separate backend/database/Auth/storage cannot be established, stop and use a separate Firebase project instead.

## UAT evidence matrix

Record **date, build SHA, tester, browser/OS, staging URL, test-case ID, PASS/FAIL/BLOCKED, screenshots/log references, and defect IDs**. Do not mark PASS based on code inspection.

| ID | Scenario | Expected result |
| --- | --- | --- |
| A01 | Admin logs in and creates valid questions | Questions saved, admin-only |
| A02 | CSV template/export/import with 500 rows | Valid rows imported, archive/snapshot preserved |
| A03 | Malformed CSV, duplicate, >500 rows, formula cells | Safe rejection/escaping; no partial data |
| A04 | Admin assigns test to synthetic SMP IT and SMK applicants | Correct assignment, instructions and time window |
| P01 | Applicant opens tracking portal and mock OTP | Only own assignment accessible |
| P02 | Applicant starts test and refreshes | Answers/timer remain consistent with server deadline |
| P03 | Applicant submits once; retries/expired submit | One final submission, no second write |
| P04 | Applicant checks result before publication | No score or answer key exposed |
| A05 | Admin views answer detail and prints | Correct/salah/kosong, points, no unrelated dashboard printed |
| A06 | Two simultaneous publication requests | One publication, one audit event, no partial updates |
| P05 | Applicant checks published result | Only authorized published score visible |
| S01 | Unauthorized user calls admin API | 401/403, no question keys or statistics |
| S02 | Applicant A requests applicant B data | Rejected |
| M01 | Chrome desktop full journey | No blocking UX defects |
| M02 | Chrome Android full journey | Timer, touch navigation, submit and results work |
| M03 | Safari iPhone full journey | Timer, touch navigation, submit and results work |
| W01 | Approved staging WhatsApp test number receives OTP | Verified delivery and expiry; only after explicit authorization |
| R01 | Restore and rollback rehearsal in isolated staging | Successful restore with documented recovery steps |

## Execution and decision

- Run TypeScript, ESLint, Firebase build, tests, and `git diff --check` against the exact candidate SHA.
- GitHub Actions billing failures are **BLOCKED — BILLING**, not PASS.
- Record all real browser and OTP tests separately. Simulated mobile viewport is not equivalent to a physical Android/iPhone test.
- Production **GO** requires zero critical defects, verified isolated staging, completed required UAT, security review, successful migration/rollback rehearsal, and explicit owner approval.
- If staging credentials or devices are unavailable, keep PR **DRAFT** and production **NO-GO**.

## Decision update (2026-11-11)

The owner requested **same-project staging** in `sinurman-2026`. The prior proposed separate project `sinurman-staging-2026` and `firebase.staging.rc.json` are obsolete references and must **not** be used for staging deployment. Use `firebase.staging.json` only after verifying independent resources and explicit target. Staging remains **NOT DEPLOYED**, mobile/WhatsApp UAT **NOT VERIFIED**, and production **NO-GO**.

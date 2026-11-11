# SPMB Staging & UAT — release gate

Status: **NO-GO production** until evidence below is recorded. This document does not authorize a deployment.

## Safety prerequisites

1. Create or identify a **separate** Firebase/GCP project, Hosting site, Cloud Run service, database, secrets and IAM scope. Do not reuse `sinurman-2026` or its data.
2. Have the authorized owner confirm the project IDs, billing impact, deployment permissions, and staging secrets **outside Git**.
3. Verify database isolation and backup/restore procedure using synthetic admissions only. Never import real production applicants for testing.
4. Ensure staging configuration never resolves to production Hosting site `sinurman-2026`, production Cloud Run service `sinurman`, or production database.
5. Set `SINURMAN_STAGING_PROJECT=<approved-staging-project>`, `SINURMAN_STAGING_DATABASE_CONFIRMED=isolated`, `SINURMAN_STAGING_OTP_MODE=mock`; run `node scripts/spmb-staging-preflight.mjs`. This script is **read-only**, not proof of actual isolation.
6. Review generated deploy plan and resource destinations with owner before any cloud deployment. No automatic production deploy or merge.

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

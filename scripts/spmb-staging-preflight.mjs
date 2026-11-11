#!/usr/bin/env node
/** Read-only safety gate for staging in the SAME Firebase project. Never deploys. */
import { readFile } from "node:fs/promises";

const errors = [];
const productionProject = "sinurman-2026";
const project = process.env.SINURMAN_STAGING_PROJECT?.trim();
const config = JSON.parse(await readFile(new URL("../firebase.json", import.meta.url), "utf8"));
const stagingConfig = JSON.parse(await readFile(new URL("../firebase.staging.json", import.meta.url), "utf8"));
const productionSite = config.hosting?.site;
const productionBackend = config.apphosting?.backendId;
const productionService = config.hosting?.rewrites?.find((r) => r.run)?.run?.serviceId;
const stagingSite = stagingConfig.hosting?.site;
const stagingService = stagingConfig.hosting?.rewrites?.find((r) => r.run)?.run?.serviceId;

if (project !== productionProject) errors.push("Project must be the explicitly approved sinurman-2026.");
if (!stagingSite || stagingSite === productionSite) errors.push("Staging Hosting site must differ from production.");
if (!stagingService || stagingService === productionService) errors.push("Staging Cloud Run service must differ from production.");
if (stagingConfig.apphosting?.backendId && stagingConfig.apphosting.backendId === productionBackend) errors.push("Staging App Hosting backend must differ from production.");
if (process.env.SINURMAN_STAGING_DATABASE_CONFIRMED !== "isolated") errors.push("Independent database must be verified, then set SINURMAN_STAGING_DATABASE_CONFIRMED=isolated.");
if (process.env.SINURMAN_STAGING_OTP_MODE !== "mock") errors.push("OTP must be mock in automated staging UAT.");
if (process.env.SINURMAN_STAGING_SECRETS_CONFIRMED !== "isolated") errors.push("Independent secrets/service credentials must be verified.");
if (process.env.SINURMAN_STAGING_SERVICE_CONFIRMED !== "isolated") errors.push("Verify staging Cloud Run service exists and is isolated.");
if (process.env.SINURMAN_STAGING_SITE_CONFIRMED !== "isolated") errors.push("Verify staging Hosting site exists and is isolated.");
if (stagingConfig.hosting?.rewrites?.length !== 1 || !stagingConfig.hosting.rewrites[0].run) errors.push("Staging must have exactly one reviewed Cloud Run rewrite.");

for (const error of errors) console.error("BLOCKED:", error);
console.log(errors.length ? "NO-GO: isolation preflight failed." : "PREFLIGHT PASS (self-attested): independently verify actual resources and permissions before deployment.");
console.log("Read-only: no cloud resources accessed or modified.");
process.exitCode = errors.length ? 1 : 0;

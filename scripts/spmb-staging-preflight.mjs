#!/usr/bin/env node
/**
 * Read-only staging deployment gate. No Firebase/GCP API calls or mutations.
 * Manual confirmations MUST be backed by inspected cloud IAM/resource evidence.
 */
import { readFile } from "node:fs/promises";
import { firebaseRuntimeTargets, STAGING } from "../lib/firebase/runtime-isolation.mjs";

const errors = [];
const production = JSON.parse(await readFile(new URL("../firebase.json", import.meta.url), "utf8"));
const staging = JSON.parse(await readFile(new URL("../firebase.staging.json", import.meta.url), "utf8"));
const env = process.env;

try { firebaseRuntimeTargets(env); }
catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }

const productionSite = production.hosting?.site;
const productionService = production.hosting?.rewrites?.find(r => r.run)?.run?.serviceId;
const productionBackend = production.apphosting?.backendId;
const stageSite = staging.hosting?.site;
const stageRewrites = staging.hosting?.rewrites ?? [];
const stageService = stageRewrites[0]?.run?.serviceId;

if (env.SINURMAN_RUNTIME_ENV !== "staging") errors.push("SINURMAN_RUNTIME_ENV=staging is required");
if (!stageSite || stageSite === productionSite || stageSite !== "sinurman-2026-staging") errors.push("Dedicated staging Hosting site required");
if (stageService !== STAGING.cloudRunService || stageService === productionService || stageRewrites.length !== 1) errors.push("Only staging Cloud Run rewrite allowed");
if (staging.apphosting?.backendId && staging.apphosting.backendId === productionBackend) errors.push("Staging App Hosting cannot reuse production backend");
for (const [key, requirement] of [
  ["SINURMAN_STAGING_DATABASE_CONFIRMED", "named database IAM isolation"],
  ["SINURMAN_STAGING_BUCKET_CONFIRMED", "dedicated bucket IAM isolation"],
  ["SINURMAN_STAGING_SECRETS_CONFIRMED", "dedicated secrets and credentials"],
  ["SINURMAN_STAGING_SERVICE_CONFIRMED", "dedicated Cloud Run runtime identity"],
  ["SINURMAN_STAGING_SITE_CONFIRMED", "independent Hosting site"],
]) if (env[key] !== "isolated") errors.push("Cloud verification missing for " + requirement + " (" + key + ")");
if (env.SINURMAN_STAGING_OTP_MODE !== "mock") errors.push("OTP must be mock for staging UAT");

for (const error of errors) console.error("BLOCKED:", error);
console.log(errors.length
  ? "NO-GO: staging safety gate failed. No deployment performed."
  : "PREFLIGHT ONLY: configuration and manual attestations pass; cloud authorization, IAM and end-to-end checks are NOT independently verified.");
console.log("Read-only: no cloud resources accessed or modified.");
process.exitCode = errors.length ? 1 : 0;

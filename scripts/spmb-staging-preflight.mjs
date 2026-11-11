#!/usr/bin/env node
/**
 * Read-only staging preflight. Never deploys, creates resources, or contacts production.
 * Usage: SINURMAN_STAGING_PROJECT=my-isolated-project node scripts/spmb-staging-preflight.mjs
 */
import { readFile } from "node:fs/promises";

const errors = [];
const warnings = [];
const project = process.env.SINURMAN_STAGING_PROJECT?.trim() || "";
const productionProject = "sinurman-2026";
const productionSite = "sinurman-2026";
const config = JSON.parse(await readFile(new URL("../firebase.json", import.meta.url), "utf8"));
const aliases = JSON.parse(await readFile(new URL("../.firebaserc", import.meta.url), "utf8"));
const productionAliases = new Set([productionProject, ...Object.values(aliases.projects || {})]);

if (!project) errors.push("SINURMAN_STAGING_PROJECT is required; no staging project has been selected.");
else if (productionAliases.has(project)) errors.push("Staging project must be different from every configured production project.");
if (config.hosting?.site === productionSite) warnings.push("firebase.json targets production Hosting. Do not deploy with this config.");
if (config.apphosting?.backendId === "sinurman") warnings.push("firebase.json names the production App Hosting backend. Do not deploy with this config.");
if (config.hosting?.rewrites?.some((r) => r.run?.serviceId === "sinurman")) warnings.push("firebase.json rewrites to production-named Cloud Run service. Require independent staging service.");
if (!process.env.SINURMAN_STAGING_DATABASE_CONFIRMED) errors.push("Confirm an independent staging database using SINURMAN_STAGING_DATABASE_CONFIRMED=isolated.");
else if (process.env.SINURMAN_STAGING_DATABASE_CONFIRMED !== "isolated") errors.push("Staging database confirmation must equal isolated.");
if (process.env.SINURMAN_STAGING_OTP_MODE !== "mock") warnings.push("OTP must be mocked for automated tests; real WhatsApp requires separately approved test numbers.");
if (project && /prod|production/i.test(project)) warnings.push("Review staging project name carefully.");

for (const message of errors) console.error("BLOCKED:", message);
for (const message of warnings) console.warn("REVIEW:", message);
console.log(errors.length ? "NO-GO: staging preflight blocked. No deployment performed." : "PREFLIGHT ONLY: checks passed; manual Firebase isolation review and approval still required. No deployment performed.");
process.exitCode = errors.length ? 1 : 0;

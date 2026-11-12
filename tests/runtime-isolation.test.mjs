import assert from "node:assert/strict";
import test from "node:test";
import { assertRuntimeIsolation } from "../lib/firebase/runtime-isolation.mjs";

test("staging Firebase fails closed when configuration is missing or production", () => {
  assert.throws(() => assertRuntimeIsolation({ SINURMAN_ENV: "staging" }), /wajib diisi/);
  assert.throws(() => assertRuntimeIsolation({ SINURMAN_ENV: "staging", FIREBASE_PROJECT_ID: "sinurman-2026", FIREBASE_STORAGE_BUCKET: "sinurman-2026.firebasestorage.app", FIREBASE_SERVICE_ACCOUNT_JSON: '{"project_id":"sinurman-2026"}' }), /production/);
  assert.equal(assertRuntimeIsolation({ SINURMAN_ENV: "staging", FIREBASE_PROJECT_ID: "sinurman-2026-stg", FIREBASE_STORAGE_BUCKET: "sinurman-2026-stg.firebasestorage.app", FIREBASE_SERVICE_ACCOUNT_JSON: '{"project_id":"sinurman-2026-stg"}' }).projectId, "sinurman-2026-stg");
});

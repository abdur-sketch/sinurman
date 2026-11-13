const ITERATIONS = 120_000;
const bytesToHex = (bytes) => Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
const hexToBytes = (value) => new Uint8Array((value.match(/.{1,2}/g) || []).map((part) => Number.parseInt(part, 16)));
export function registrationPinEnabled(env) { return env.SPMB_REGISTRATION_PIN_ENABLED === "true"; }
export function generateRegistrationPin() { const values = new Uint32Array(1); crypto.getRandomValues(values); return String(10_000_000 + (values[0] % 90_000_000)); }
export async function hashRegistrationPin(pin, saltHex) { const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16)); const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]); const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, material, 256); return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) }; }
export async function verifyRegistrationPin(pin, hash, salt) { const candidate = await hashRegistrationPin(pin, salt); let diff = candidate.hash.length ^ hash.length; for (let index = 0; index < Math.min(candidate.hash.length, hash.length); index++) diff |= candidate.hash.charCodeAt(index) ^ hash.charCodeAt(index); return diff === 0; }
export const validRegistrationPin = (value) => /^\d{8,16}$/.test(String(value ?? ""));

import assert from "node:assert/strict";
import test from "node:test";
import { generateRegistrationPin, hashRegistrationPin, registrationPinEnabled, validRegistrationPin, verifyRegistrationPin } from "../lib/spmb-pin.mjs";

test("registration PIN uses CSPRNG and never verifies in plaintext", async () => {
  const pin = generateRegistrationPin();
  assert.match(pin, /^\d{8}$/);
  assert.equal(validRegistrationPin(pin), true);
  const stored = await hashRegistrationPin(pin);
  assert.notEqual(stored.hash, pin);
  assert.equal(await verifyRegistrationPin(pin, stored.hash, stored.salt), true);
  assert.equal(await verifyRegistrationPin("00000000", stored.hash, stored.salt), false);
});

test("registration PIN feature flag is fail-closed", () => {
  assert.equal(registrationPinEnabled({}), false);
  assert.equal(registrationPinEnabled({ SPMB_REGISTRATION_PIN_ENABLED: "false" }), false);
  assert.equal(registrationPinEnabled({ SPMB_REGISTRATION_PIN_ENABLED: "true" }), true);
});

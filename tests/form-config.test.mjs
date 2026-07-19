import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/form-config.js";

test("form config exposes only valid public analytics identifiers", async () => {
  const response = onRequestGet({ env: {
    TURNSTILE_SITE_KEY: "site-key",
    TURNSTILE_EXPECTED_ACTION: "estimate_request",
    GTM_CONTAINER_ID: "GTM-ABC123",
    GA4_MEASUREMENT_ID: "not-a-ga-id",
    GOOGLE_ADS_ID: "AW-123456789",
  } });
  const config = await response.json();
  assert.deepEqual(config, {
    turnstileSiteKey: "site-key",
    turnstileAction: "estimate_request",
    gtmContainerId: "GTM-ABC123",
    ga4MeasurementId: "",
    googleAdsId: "AW-123456789",
  });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

import test from "node:test";
import assert from "node:assert/strict";
import { normalizeServiceSelection, onRequest } from "../functions/api/lead.js";
import { hasValidImageMagic } from "../functions/api/upload-photo.js";

class MemoryKv { constructor() { this.store = new Map(); } async get(key) { return this.store.get(key) || null; } async put(key, value) { this.store.set(key, value); } }
class FailingIdempotencyKv extends MemoryKv {
  async put(key, value) {
    if (key.startsWith("lead-idempotency:")) throw new Error("simulated KV write failure");
    return super.put(key, value);
  }
}
const contact = { full_name: "Test Homeowner", phone: "2155550100", email: "test@example.com", zip_code: "19019", property_address: "1 Main Street", service_needed: ["Gutter Replacement"], idempotency_key: "lead-test-1" };
const request = (body) => new Request("https://site.test/api/lead", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.4" }, body: JSON.stringify(body) });

test("one service maps to its exact GHL dropdown value", () => {
  const result = normalizeServiceSelection(["Gutter Replacement"]);
  assert.deepEqual(result.original, ["Gutter Replacement"]);
  assert.deepEqual(result.values, ["gutter_replacement"]);
  assert.equal(result.valuesCsv, "gutter_replacement");
  assert.equal(result.text, "Gutter Replacement");
});

test("comma-separated services preserve order and normalize human text", () => {
  const original = "Seamless Gutter Installation,  Soffit & Fascia";
  const result = normalizeServiceSelection(original);
  assert.equal(result.original, original);
  assert.deepEqual(result.values, ["seamless_gutter_installation", "soffit_fascia"]);
  assert.equal(result.valuesCsv, "seamless_gutter_installation,soffit_fascia");
  assert.equal(result.text, "Seamless Gutter Installation, Soffit & Fascia");
});

test("HTML entities are decoded before service mapping", () => {
  const result = normalizeServiceSelection(["  Soffit &amp; Fascia  "]);
  assert.deepEqual(result.original, ["Soffit &amp; Fascia"]);
  assert.deepEqual(result.values, ["soffit_fascia"]);
  assert.equal(result.text, "Soffit & Fascia");
});

test("normalized services are deduplicated after trimming and decoding", () => {
  const result = normalizeServiceSelection([" Gutter Guards ", "Gutter Guards", "Soffit &amp; Fascia", "Soffit & Fascia"]);
  assert.deepEqual(result.values, ["gutter_guards", "soffit_fascia"]);
  assert.equal(result.valuesCsv, "gutter_guards,soffit_fascia");
  assert.equal(result.text, "Gutter Guards, Soffit & Fascia");
});

test("unknown services stay in human context but never enter dropdown values", () => {
  const original = ["Roof Repair", "Gutter Guards", " Roof Repair "];
  const result = normalizeServiceSelection(original);
  assert.deepEqual(result.original, ["Roof Repair", "Gutter Guards", "Roof Repair"]);
  assert.deepEqual(result.values, ["gutter_guards"]);
  assert.equal(result.valuesCsv, "gutter_guards");
  assert.equal(result.text, "Roof Repair, Gutter Guards");
});

test("empty service inputs normalize to empty fields", () => {
  for (const value of ["", "   ", []]) {
    const result = normalizeServiceSelection(value);
    assert.deepEqual(result.values, []);
    assert.equal(result.valuesCsv, "");
    assert.equal(result.text, "");
  }
});

test("both miter labels map to the canonical GHL option without breaking the calculator label", () => {
  const result = normalizeServiceSelection(["Gutter Miters & Connectors", "Gutter Miters & Downspout Connectors"]);
  assert.deepEqual(result.values, ["gutter_miters_downspout_connectors"]);
  assert.equal(result.text, "Gutter Miters & Downspout Connectors");
  assert.deepEqual(result.calculatorServices, ["Gutter Miters & Connectors"]);
});

test("basic request submits without calculator and has no estimate", async () => {
  const original = globalThis.fetch; const calls = []; globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response("ok", { status: 200 }); };
  try { const response = await onRequest({ request: request(contact), env: { GHL_WEBHOOK_URL: "https://example.test/webhook", LEAD_RATE_LIMIT_KV: new MemoryKv() } }); const body = await response.json(); assert.equal(body.estimate_status, "not_requested"); const sent = JSON.parse(calls[0].options.body); assert.equal(sent.phone, "+12155550100"); assert.equal(sent.estimate_base_total, 0); assert.equal(typeof sent.estimate_inputs_json, "string"); assert.deepEqual(JSON.parse(sent.estimate_inputs_json).services, ["Gutter Replacement"]); assert.equal(typeof sent.estimate_line_items_json, "string"); assert.deepEqual(JSON.parse(sent.estimate_line_items_json), []); assert.ok(Number.isFinite(Date.parse(sent.submission_timestamp))); } finally { globalThis.fetch = original; }
});

test("webhook receives legacy and normalized service fields from a comma-separated selection", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response("ok", { status: 200 }); };
  try {
    const serviceNeeded = "Seamless Gutter Installation, Soffit &amp; Fascia";
    const response = await onRequest({
      request: request({
        ...contact,
        zip_code: "19057",
        idempotency_key: "lead-service-normalization",
        service_needed: serviceNeeded,
        service_needed_values: ["spoofed"],
        service_needed_values_csv: "spoofed",
        service_needed_text: "Spoofed",
      }),
      env: { GHL_WEBHOOK_URL: "https://example.test/webhook", LEAD_RATE_LIMIT_KV: new MemoryKv() },
    });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    const sent = JSON.parse(calls[0].options.body);
    assert.equal(sent.service_needed, serviceNeeded);
    assert.deepEqual(sent.service_needed_values, ["seamless_gutter_installation", "soffit_fascia"]);
    assert.equal(sent.service_needed_values_csv, "seamless_gutter_installation,soffit_fascia");
    assert.equal(sent.service_needed_text, "Seamless Gutter Installation, Soffit & Fascia");
    assert.equal(sent.service_area_status, "supported_area");
    assert.equal(sent.estimate_status, "not_requested");
    assert.deepEqual(sent.uploaded_photos, []);
    assert.equal(sent.uploaded_photos_text, "");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("webhook preserves mixed known and unknown legacy services", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response("ok", { status: 200 }); };
  try {
    const serviceNeeded = ["Roof Repair", "Gutter Guards", "Soffit &amp; Fascia"];
    const response = await onRequest({
      request: request({ ...contact, idempotency_key: "lead-service-unknown", service_needed: serviceNeeded }),
      env: { GHL_WEBHOOK_URL: "https://example.test/webhook", LEAD_RATE_LIMIT_KV: new MemoryKv() },
    });
    assert.equal(response.status, 200);
    const sent = JSON.parse(calls[0].options.body);
    assert.deepEqual(sent.service_needed, serviceNeeded);
    assert.deepEqual(sent.service_needed_values, ["gutter_guards", "soffit_fascia"]);
    assert.equal(sent.service_needed_values_csv, "gutter_guards,soffit_fascia");
    assert.equal(sent.service_needed_text, "Roof Repair, Gutter Guards, Soffit & Fascia");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("server sends authoritative supported, review, and outside-area ZIP statuses", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response("ok", { status: 200 }); };
  try {
    const cases = [
      { zip: "19057", configured: "", expected: "supported_area" },
      { zip: "08001", configured: " 19103, 08001, invalid ", expected: "supported_area" },
      { zip: "19058", configured: "", expected: "needs_review" },
      { zip: "90210", configured: "", expected: "outside_primary_area" },
    ];
    for (const [index, item] of cases.entries()) {
      const response = await onRequest({
        request: request({ ...contact, zip_code: item.zip, idempotency_key: `lead-area-${index}`, service_area_status: "supported_area" }),
        env: { GHL_WEBHOOK_URL: "https://example.test/webhook", LEAD_RATE_LIMIT_KV: new MemoryKv(), SUPPORTED_ZIPS: item.configured },
      });
      assert.equal(response.status, 200, item.zip);
      const sent = JSON.parse(calls[index].options.body);
      assert.equal(sent.service_area_status, item.expected, item.zip);
    }
  } finally {
    globalThis.fetch = original;
  }
});

test("server ignores tampered display estimate and returns its own total", async () => {
  const original = globalThis.fetch; const calls = []; globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response("ok", { status: 200 }); };
  try { const env = { GHL_WEBHOOK_URL: "https://example.test/webhook", LEAD_RATE_LIMIT_KV: new MemoryKv() }; const body = { ...contact, idempotency_key: "lead-test-2", calculator_requested: true, gutter_size: "5", home_stories: 1, square_feet: 2000, include_gutters: true, customer_display_estimate: 1 }; const response = await onRequest({ request: request(body), env }); const result = await response.json(); assert.equal(result.customer_display_estimate, 2766); const sent = JSON.parse(calls[0].options.body); assert.equal(sent.estimate_base_total, 2685); assert.equal(sent.customer_display_estimate, 2766); } finally { globalThis.fetch = original; }
});

test("lead rejects external photo URLs", async () => {
  const original = globalThis.fetch; globalThis.fetch = async () => new Response("ok", { status: 200 });
  try { const response = await onRequest({ request: request({ ...contact, idempotency_key: "lead-test-3", uploaded_photos: ["https://evil.example/photo.jpg"] }), env: { GHL_WEBHOOK_URL: "https://example.test/webhook", LEAD_RATE_LIMIT_KV: new MemoryKv() } }); assert.equal(response.status, 400); } finally { globalThis.fetch = original; }
});

test("lead rejects more than ten photo URLs before delivery", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response("ok", { status: 200 }); };
  try {
    const uploadedPhotos = Array.from({ length: 11 }, (_, index) => `https://site.test/api/photo/${String(index).padStart(64, "0")}`);
    const response = await onRequest({
      request: request({ ...contact, idempotency_key: "lead-test-too-many-photos", uploaded_photos: uploadedPhotos }),
      env: { GHL_WEBHOOK_URL: "https://example.test/webhook", LEAD_RATE_LIMIT_KV: new MemoryKv() },
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "invalid_photos");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("lead rejects unknown-only, empty services, invalid phone numbers, and invalid ZIP codes", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response("ok", { status: 200 }); };
  try {
    const env = { GHL_WEBHOOK_URL: "https://example.test/webhook", LEAD_RATE_LIMIT_KV: new MemoryKv() };
    const unknownService = await onRequest({ request: request({ ...contact, idempotency_key: "lead-test-4", service_needed: ["Roof Replacement"] }), env });
    assert.equal(unknownService.status, 400);
    const emptyService = await onRequest({ request: request({ ...contact, idempotency_key: "lead-test-empty-service", service_needed: "   " }), env });
    assert.equal(emptyService.status, 400);
    const emptyServiceArray = await onRequest({ request: request({ ...contact, idempotency_key: "lead-test-empty-service-array", service_needed: [] }), env });
    assert.equal(emptyServiceArray.status, 400);
    const invalidPhone = await onRequest({ request: request({ ...contact, idempotency_key: "lead-test-5", phone: "123" }), env });
    assert.equal(invalidPhone.status, 400);
    const invalidZip = await onRequest({ request: request({ ...contact, idempotency_key: "lead-test-6", zip_code: "1905" }), env });
    assert.equal(invalidZip.status, 400);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("upload magic-byte validation rejects a renamed non-image file", async () => {
  const fakeJpeg = { type: "image/jpeg", slice: () => new Blob([new Uint8Array([0x00, 0x01, 0x02, 0x03])]) };
  const png = { type: "image/png", slice: () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]) };
  assert.equal(await hasValidImageMagic(fakeJpeg), false);
  assert.equal(await hasValidImageMagic(png), true);
});

test("a successful GHL delivery remains successful when the idempotency receipt cannot be persisted", async () => {
  const original = globalThis.fetch;
  let webhookCalls = 0;
  globalThis.fetch = async () => {
    webhookCalls += 1;
    return new Response("ok", { status: 200 });
  };
  try {
    const response = await onRequest({
      request: request({ ...contact, idempotency_key: "lead-test-kv-failure" }),
      env: {
        GHL_WEBHOOK_URL: "https://example.test/webhook",
        LEAD_RATE_LIMIT_KV: new FailingIdempotencyKv(),
      },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.delivery_state_saved, false);
    assert.equal(webhookCalls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

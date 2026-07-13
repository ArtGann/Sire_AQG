import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/lead.js";
import { hasValidImageMagic } from "../functions/api/upload-photo.js";

class MemoryKv { constructor() { this.store = new Map(); } async get(key) { return this.store.get(key) || null; } async put(key, value) { this.store.set(key, value); } }
const contact = { full_name: "Test Homeowner", phone: "2155550100", email: "test@example.com", zip_code: "19019", property_address: "1 Main Street", service_needed: ["Gutter Replacement"], idempotency_key: "lead-test-1" };
const request = (body) => new Request("https://site.test/api/lead", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.4" }, body: JSON.stringify(body) });

test("basic request submits without calculator and has no estimate", async () => {
  const original = globalThis.fetch; const calls = []; globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response("ok", { status: 200 }); };
  try { const response = await onRequest({ request: request(contact), env: { GHL_WEBHOOK_URL: "https://example.test/webhook", LEAD_RATE_LIMIT_KV: new MemoryKv() } }); const body = await response.json(); assert.equal(body.estimate_status, "not_requested"); const sent = JSON.parse(calls[0].options.body); assert.equal(sent.estimate_base_total, 0); assert.equal(typeof sent.estimate_inputs_json, "string"); assert.deepEqual(JSON.parse(sent.estimate_inputs_json).services, ["Gutter Replacement"]); assert.equal(typeof sent.estimate_line_items_json, "string"); assert.deepEqual(JSON.parse(sent.estimate_line_items_json), []); assert.ok(Number.isFinite(Date.parse(sent.submission_timestamp))); } finally { globalThis.fetch = original; }
});

test("server ignores tampered display estimate and returns its own total", async () => {
  const original = globalThis.fetch; const calls = []; globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response("ok", { status: 200 }); };
  try { const env = { GHL_WEBHOOK_URL: "https://example.test/webhook", LEAD_RATE_LIMIT_KV: new MemoryKv() }; const body = { ...contact, idempotency_key: "lead-test-2", calculator_requested: true, gutter_size: "5", home_stories: 1, square_feet: 2000, include_gutters: true, customer_display_estimate: 1 }; const response = await onRequest({ request: request(body), env }); const result = await response.json(); assert.equal(result.customer_display_estimate, 2766); const sent = JSON.parse(calls[0].options.body); assert.equal(sent.estimate_base_total, 2685); assert.equal(sent.customer_display_estimate, 2766); } finally { globalThis.fetch = original; }
});

test("lead rejects external photo URLs", async () => {
  const original = globalThis.fetch; globalThis.fetch = async () => new Response("ok", { status: 200 });
  try { const response = await onRequest({ request: request({ ...contact, idempotency_key: "lead-test-3", uploaded_photos: ["https://evil.example/photo.jpg"] }), env: { GHL_WEBHOOK_URL: "https://example.test/webhook", R2_PUBLIC_BASE_URL: "https://images.example/leads", LEAD_RATE_LIMIT_KV: new MemoryKv() } }); assert.equal(response.status, 400); } finally { globalThis.fetch = original; }
});

test("upload magic-byte validation rejects a renamed non-image file", async () => {
  const fakeJpeg = { type: "image/jpeg", slice: () => new Blob([new Uint8Array([0x00, 0x01, 0x02, 0x03])]) };
  const png = { type: "image/png", slice: () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]) };
  assert.equal(await hasValidImageMagic(fakeJpeg), false);
  assert.equal(await hasValidImageMagic(png), true);
});

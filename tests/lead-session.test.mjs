import test from "node:test";
import assert from "node:assert/strict";
import { onRequest as createLeadSession } from "../functions/api/lead-session.js";
import { onRequest as submitLead } from "../functions/api/lead.js";
import { onRequestPost as uploadPhoto } from "../functions/api/upload-photo.js";
import { onRequest as servePhoto } from "../functions/api/photo/[photoId].js";

class MemoryKv {
  constructor() { this.store = new Map(); }
  async get(key) { return this.store.get(key) || null; }
  async put(key, value) { this.store.set(key, value); }
}

class MemoryBucket {
  constructor() { this.store = new Map(); this.version = 0; }
  async put(key, body, options = {}) {
    const current = this.store.get(key);
    if (options.onlyIf?.etagDoesNotMatch === "*" && current) return null;
    if (options.onlyIf?.etagMatches && current?.etag !== options.onlyIf.etagMatches) return null;
    const bytes = new Uint8Array(await new Response(body).arrayBuffer());
    const etag = `memory-${++this.version}`;
    const value = { bytes, etag, httpMetadata: options.httpMetadata || {}, customMetadata: options.customMetadata || {}, httpEtag: `"${etag}"` };
    this.store.set(key, value);
    return value;
  }
  async get(key) {
    const value = this.store.get(key);
    return value ? { ...value, body: value.bytes } : null;
  }
  async head(key) {
    const value = this.store.get(key);
    return value ? { etag: value.etag, httpMetadata: value.httpMetadata, customMetadata: value.customMetadata, httpEtag: value.httpEtag } : null;
  }
  async delete(key) { this.store.delete(key); }
}

const contact = {
  full_name: "Test Homeowner",
  phone: "2155550100",
  email: "test@example.com",
  zip_code: "19019",
  property_address: "1 Main Street",
  service_needed: ["Gutter Replacement"],
};

const jsonRequest = (url, body) => new Request(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.8" },
  body: JSON.stringify(body),
});

test("a Turnstile-validated lead session is reused without redeeming the token twice", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({ success: true, hostname: "www.allqualitygutters.com", action: "estimate_lead" }), { status: 200 });
    }
    return new Response("ok", { status: 200 });
  };

  try {
    const kv = new MemoryKv();
    const env = {
      GHL_WEBHOOK_URL: "https://example.test/webhook",
      LEAD_RATE_LIMIT_KV: kv,
      LEAD_PHOTOS_BUCKET: new MemoryBucket(),
      TURNSTILE_SECRET_KEY: "secret",
      TURNSTILE_ENFORCE: "true",
      TURNSTILE_EXPECTED_HOSTNAMES: "www.allqualitygutters.com",
      TURNSTILE_EXPECTED_ACTION: "estimate_lead",
    };
    const id = "session-lead-1";
    const sessionResponse = await createLeadSession({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead-session", { idempotency_key: id, turnstile_token: "turnstile-once" }),
      env,
    });
    assert.equal(sessionResponse.status, 200);
    const session = await sessionResponse.json();
    assert.ok(session.lead_session_token);

    const response = await submitLead({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead", {
        ...contact,
        idempotency_key: id,
        lead_session_token: session.lead_session_token,
        first_landing_page_url: "https://www.allqualitygutters.com/services/gutter-replacement/?private=1",
        first_utm_source: "google",
        first_utm_campaign: "x".repeat(260),
        gbraid: "gbraid-123",
        session_id: "session-browser-1",
        cta_location: "hero",
      }),
      env,
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.event_id, id);
    assert.equal(calls.filter((call) => call.url.includes("siteverify")).length, 1);
    assert.equal(calls.filter((call) => call.url.includes("/webhook")).length, 1);

    const webhookCall = calls.find((call) => call.url.includes("/webhook"));
    const sent = JSON.parse(webhookCall.options.body);
    assert.equal(sent.event_id, id);
    assert.equal(sent.first_landing_page_url, "https://www.allqualitygutters.com/services/gutter-replacement/");
    assert.equal(sent.first_utm_source, "google");
    assert.equal(sent.first_utm_campaign.length, 200);
    assert.equal(sent.gbraid, "gbraid-123");
    assert.equal(sent.session_id, "session-browser-1");
    assert.equal(sent.cta_location, "hero");

    const duplicateResponse = await submitLead({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead", {
        ...contact,
        idempotency_key: id,
        lead_session_token: session.lead_session_token,
      }),
      env,
    });
    assert.equal((await duplicateResponse.json()).duplicate, true);
    assert.equal(calls.filter((call) => call.url.includes("/webhook")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the current direct lead path validates one Turnstile token exactly once", async () => {
  const originalFetch = globalThis.fetch;
  let siteverifyCalls = 0;
  let webhookCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("siteverify")) {
      siteverifyCalls += 1;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    webhookCalls += 1;
    return new Response("ok", { status: 200 });
  };

  try {
    const response = await submitLead({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead", {
        ...contact,
        idempotency_key: "direct-lead-1",
        turnstile_token: "direct-turnstile-token",
      }),
      env: {
        GHL_WEBHOOK_URL: "https://example.test/webhook",
        LEAD_RATE_LIMIT_KV: new MemoryKv(),
        LEAD_PHOTOS_BUCKET: new MemoryBucket(),
        TURNSTILE_SECRET_KEY: "secret",
        TURNSTILE_ENFORCE: "true",
      },
    });
    assert.equal(response.status, 200);
    assert.equal(siteverifyCalls, 1);
    assert.equal(webhookCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a failed GHL delivery can be retried with a fresh Turnstile token", async () => {
  const originalFetch = globalThis.fetch;
  let siteverifyCalls = 0;
  let webhookCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("siteverify")) {
      siteverifyCalls += 1;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    webhookCalls += 1;
    return new Response(webhookCalls === 1 ? "temporary failure" : "ok", { status: webhookCalls === 1 ? 503 : 200 });
  };

  try {
    const kv = new MemoryKv();
    const env = {
      GHL_WEBHOOK_URL: "https://example.test/webhook",
      LEAD_RATE_LIMIT_KV: kv,
      TURNSTILE_SECRET_KEY: "secret",
      TURNSTILE_ENFORCE: "true",
    };
    const first = await submitLead({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead", {
        ...contact,
        idempotency_key: "direct-retry-1",
        turnstile_token: "turnstile-first",
      }),
      env,
    });
    assert.equal(first.status, 502);

    const retry = await submitLead({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead", {
        ...contact,
        idempotency_key: "direct-retry-1",
        turnstile_token: "turnstile-fresh",
      }),
      env,
    });
    assert.equal(retry.status, 200);
    assert.equal(siteverifyCalls, 2);
    assert.equal(webhookCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("lead session rejects a Turnstile token issued for another hostname", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, hostname: "evil.example", action: "estimate_lead" }), { status: 200 });
  try {
    const response = await createLeadSession({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead-session", { idempotency_key: "wrong-host-1", turnstile_token: "token" }),
      env: {
        LEAD_RATE_LIMIT_KV: new MemoryKv(),
        LEAD_PHOTOS_BUCKET: new MemoryBucket(),
        TURNSTILE_SECRET_KEY: "secret",
        TURNSTILE_ENFORCE: "true",
        TURNSTILE_EXPECTED_HOSTNAMES: "www.allqualitygutters.com",
        TURNSTILE_EXPECTED_ACTION: "estimate_lead",
      },
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "turnstile_hostname_mismatch");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("photo sessions fail closed when production Turnstile validation is not fully configured", async () => {
  const response = await createLeadSession({
    request: jsonRequest("https://www.allqualitygutters.com/api/lead-session", {
      idempotency_key: "missing-turnstile-config",
      turnstile_token: "unverified-token",
    }),
    env: {
      LEAD_RATE_LIMIT_KV: new MemoryKv(),
      LEAD_PHOTOS_BUCKET: new MemoryBucket(),
    },
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "lead_session_not_configured");
});

test("expired R2 sessions reject both photo uploads and final lead submissions", async () => {
  const originalFetch = globalThis.fetch;
  let webhookCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({ success: true, hostname: "www.allqualitygutters.com", action: "estimate_request" }), { status: 200 });
    }
    webhookCalls += 1;
    return new Response("ok", { status: 200 });
  };

  try {
    const bucket = new MemoryBucket();
    const env = {
      GHL_WEBHOOK_URL: "https://example.test/webhook",
      LEAD_RATE_LIMIT_KV: new MemoryKv(),
      LEAD_PHOTOS_BUCKET: bucket,
      TURNSTILE_SECRET_KEY: "secret",
      TURNSTILE_ENFORCE: "true",
      TURNSTILE_EXPECTED_HOSTNAMES: "www.allqualitygutters.com",
      TURNSTILE_EXPECTED_ACTION: "estimate_request",
    };
    const id = "expired-photo-session";
    const sessionResponse = await createLeadSession({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead-session", { idempotency_key: id, turnstile_token: "photo-turnstile-expired" }),
      env,
    });
    const session = await sessionResponse.json();
    const [sessionKey, stored] = [...bucket.store.entries()].find(([key]) => key.startsWith("lead-sessions/"));
    const expired = { ...JSON.parse(new TextDecoder().decode(stored.bytes)), expires_at: Date.now() - 1 };
    await bucket.put(sessionKey, JSON.stringify(expired), { httpMetadata: { contentType: "application/json" } });

    const photo = new FormData();
    photo.append("photo", new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "expired.jpg", { type: "image/jpeg" }));
    photo.append("photo_slot", "0");
    photo.append("idempotency_key", id);
    photo.append("lead_session_token", session.lead_session_token);
    const uploadResponse = await uploadPhoto({
      request: new Request("https://www.allqualitygutters.com/api/upload-photo", { method: "POST", body: photo }),
      env,
    });
    assert.equal(uploadResponse.status, 400);
    assert.equal((await uploadResponse.json()).code, "lead_session_expired");

    const leadResponse = await submitLead({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead", {
        ...contact,
        idempotency_key: id,
        lead_session_token: session.lead_session_token,
      }),
      env,
    });
    assert.equal(leadResponse.status, 400);
    assert.equal((await leadResponse.json()).code, "lead_session_expired");
    assert.equal(webhookCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an R2 session claim permits only one concurrent webhook submission", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, hostname: "www.allqualitygutters.com", action: "estimate_request" }), { status: 200 });

  try {
    const env = {
      GHL_WEBHOOK_URL: "https://example.test/webhook",
      LEAD_RATE_LIMIT_KV: new MemoryKv(),
      LEAD_PHOTOS_BUCKET: new MemoryBucket(),
      TURNSTILE_SECRET_KEY: "secret",
      TURNSTILE_ENFORCE: "true",
      TURNSTILE_EXPECTED_HOSTNAMES: "www.allqualitygutters.com",
      TURNSTILE_EXPECTED_ACTION: "estimate_request",
    };
    const id = "concurrent-photo-session";
    const sessionResponse = await createLeadSession({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead-session", { idempotency_key: id, turnstile_token: "photo-turnstile-concurrent" }),
      env,
    });
    const session = await sessionResponse.json();

    let releaseWebhook;
    const webhookGate = new Promise((resolve) => { releaseWebhook = resolve; });
    let webhookCalls = 0;
    globalThis.fetch = async () => {
      webhookCalls += 1;
      await webhookGate;
      return new Response("ok", { status: 200 });
    };

    const leadPayload = { ...contact, idempotency_key: id, lead_session_token: session.lead_session_token };
    const firstSubmission = submitLead({ request: jsonRequest("https://www.allqualitygutters.com/api/lead", leadPayload), env });
    while (webhookCalls === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    const secondResponse = await submitLead({ request: jsonRequest("https://www.allqualitygutters.com/api/lead", leadPayload), env });
    assert.equal(secondResponse.status, 409);
    assert.equal((await secondResponse.json()).code, "lead_session_closed");
    assert.equal(webhookCalls, 1);

    releaseWebhook();
    const firstResponse = await firstSubmission;
    assert.equal(firstResponse.status, 200);
    assert.equal(webhookCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("photo upload accepts a validated lead session without calling Siteverify again", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async (url) => {
    fetchCalls += 1;
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({ success: true, hostname: "www.allqualitygutters.com", action: "estimate_request" }), { status: 200 });
    }
    return new Response("unexpected", { status: 500 });
  };

  try {
    const kv = new MemoryKv();
    const bucket = new MemoryBucket();
    const env = {
      LEAD_RATE_LIMIT_KV: kv,
      LEAD_PHOTOS_BUCKET: bucket,
      TURNSTILE_SECRET_KEY: "secret",
      TURNSTILE_ENFORCE: "true",
      TURNSTILE_EXPECTED_HOSTNAMES: "www.allqualitygutters.com",
      TURNSTILE_EXPECTED_ACTION: "estimate_request",
    };
    const id = "photo-session-1";
    const sessionResponse = await createLeadSession({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead-session", { idempotency_key: id, turnstile_token: "photo-turnstile-1" }),
      env,
    });
    const session = await sessionResponse.json();
    assert.ok(session.lead_session_token);
    assert.equal(fetchCalls, 1);
    fetchCalls = 0;

    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const form = new FormData();
    form.append("photo", new File([pngHeader], "roof.png", { type: "image/png" }));
    form.append("photo_slot", "0");
    form.append("idempotency_key", id);
    form.append("lead_session_token", session.lead_session_token);
    const response = await uploadPhoto({
      request: new Request("https://www.allqualitygutters.com/api/upload-photo", { method: "POST", headers: { "CF-Connecting-IP": "203.0.113.8" }, body: form }),
      env,
    });
    assert.equal(response.status, 200);
    assert.equal(fetchCalls, 0);
    const result = await response.json();
    assert.match(result.url, /^https:\/\/www\.allqualitygutters\.com\/api\/photo\/[a-f0-9]{64}$/);
    assert.equal([...bucket.store.keys()].filter((key) => key.startsWith("lead-photos/")).length, 1);

    const photoId = new URL(result.url).pathname.split("/").pop();
    const served = await servePhoto({
      request: new Request(result.url),
      env,
      params: { photoId },
    });
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("Content-Type"), "image/png");
    assert.deepEqual(new Uint8Array(await served.arrayBuffer()), pngHeader);

    const receiptKey = [...bucket.store.keys()].find((key) => key.startsWith("lead-session-photos/"));
    await bucket.delete(receiptKey);
    const repeated = new FormData();
    repeated.append("photo", new File([pngHeader], "roof-again.png", { type: "image/png" }));
    repeated.append("photo_slot", "0");
    repeated.append("idempotency_key", id);
    repeated.append("lead_session_token", session.lead_session_token);
    const repeatedResponse = await uploadPhoto({
      request: new Request("https://www.allqualitygutters.com/api/upload-photo", { method: "POST", body: repeated }),
      env,
    });
    assert.equal(repeatedResponse.status, 200);
    assert.equal((await repeatedResponse.json()).duplicate, true);
    assert.equal([...bucket.store.keys()].filter((key) => key.startsWith("lead-session-photos/")).length, 1);
    assert.equal([...bucket.store.keys()].filter((key) => key.startsWith("lead-photos/")).length, 1);

    const replacement = new FormData();
    replacement.append("photo", new File([new Uint8Array([...pngHeader, 1])], "different.png", { type: "image/png" }));
    replacement.append("photo_slot", "0");
    replacement.append("idempotency_key", id);
    replacement.append("lead_session_token", session.lead_session_token);
    const replacementResponse = await uploadPhoto({
      request: new Request("https://www.allqualitygutters.com/api/upload-photo", { method: "POST", body: replacement }),
      env,
    });
    assert.equal(replacementResponse.status, 409);
    assert.equal((await replacementResponse.json()).code, "photo_slot_used");
    assert.deepEqual(new Uint8Array(bucket.store.get(`lead-photos/${photoId}`).bytes), pngHeader);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ten R2 photos are session-bound and sent to both GHL photo fields", async () => {
  const originalFetch = globalThis.fetch;
  const webhookCalls = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({ success: true, hostname: "www.allqualitygutters.com", action: "estimate_request" }), { status: 200 });
    }
    webhookCalls.push({ url: String(url), options });
    return new Response("ok", { status: 200 });
  };

  try {
    const kv = new MemoryKv();
    const bucket = new MemoryBucket();
    const env = {
      GHL_WEBHOOK_URL: "https://example.test/webhook",
      LEAD_RATE_LIMIT_KV: kv,
      LEAD_PHOTOS_BUCKET: bucket,
      TURNSTILE_SECRET_KEY: "secret",
      TURNSTILE_ENFORCE: "true",
      TURNSTILE_EXPECTED_HOSTNAMES: "www.allqualitygutters.com",
      TURNSTILE_EXPECTED_ACTION: "estimate_request",
    };
    const id = "photo-session-ten";
    const sessionResponse = await createLeadSession({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead-session", { idempotency_key: id, turnstile_token: "photo-turnstile-ten" }),
      env,
    });
    const session = await sessionResponse.json();
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const urls = [];

    for (let slot = 0; slot < 10; slot += 1) {
      const form = new FormData();
      form.append("photo", new File([pngHeader], `roof-${slot}.png`, { type: "image/png" }));
      form.append("photo_slot", String(slot));
      form.append("idempotency_key", id);
      form.append("lead_session_token", session.lead_session_token);
      const response = await uploadPhoto({
        request: new Request("https://www.allqualitygutters.com/api/upload-photo", {
          method: "POST",
          headers: { "CF-Connecting-IP": "203.0.113.9" },
          body: form,
        }),
        env,
      });
      assert.equal(response.status, 200);
      urls.push((await response.json()).url);
    }

    assert.equal(new Set(urls).size, 10);
    assert.equal([...bucket.store.keys()].filter((key) => key.startsWith("lead-photos/")).length, 10);
    assert.equal([...bucket.store.keys()].filter((key) => key.startsWith("lead-session-photos/")).length, 10);
    assert.equal([...bucket.store.keys()].filter((key) => key.startsWith("lead-sessions/")).length, 1);

    const [receiptKey, receiptObject] = [...bucket.store.entries()].find(([key]) => key.startsWith("lead-session-photos/"));
    const receipt = JSON.parse(new TextDecoder().decode(receiptObject.bytes));
    await bucket.put(receiptKey, JSON.stringify({ ...receipt, session_generation: "stale-session-generation" }), {
      httpMetadata: { contentType: "application/json" },
    });
    const staleReceiptSubmission = await submitLead({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead", {
        ...contact,
        idempotency_key: id,
        lead_session_token: session.lead_session_token,
        uploaded_photos: urls,
      }),
      env,
    });
    assert.equal(staleReceiptSubmission.status, 400);
    assert.equal((await staleReceiptSubmission.json()).code, "invalid_photos");
    await bucket.put(receiptKey, JSON.stringify(receipt), { httpMetadata: { contentType: "application/json" } });

    const eleventh = new FormData();
    eleventh.append("photo", new File([pngHeader], "roof-10.png", { type: "image/png" }));
    eleventh.append("photo_slot", "10");
    eleventh.append("idempotency_key", id);
    eleventh.append("lead_session_token", session.lead_session_token);
    const rejectedUpload = await uploadPhoto({
      request: new Request("https://www.allqualitygutters.com/api/upload-photo", { method: "POST", body: eleventh }),
      env,
    });
    assert.equal(rejectedUpload.status, 400);

    const fabricated = await submitLead({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead", {
        ...contact,
        idempotency_key: id,
        lead_session_token: session.lead_session_token,
        uploaded_photos: [`https://www.allqualitygutters.com/api/photo/${"a".repeat(64)}`],
      }),
      env,
    });
    assert.equal(fabricated.status, 400);

    const submitted = await submitLead({
      request: jsonRequest("https://www.allqualitygutters.com/api/lead", {
        ...contact,
        idempotency_key: id,
        lead_session_token: session.lead_session_token,
        uploaded_photos: urls,
      }),
      env,
    });
    assert.equal(submitted.status, 200);
    const sent = JSON.parse(webhookCalls.at(-1).options.body);
    assert.deepEqual(sent.uploaded_photos, urls);
    assert.equal(sent.uploaded_photos_text, urls.join("\n"));
    const storedSession = [...bucket.store.entries()].find(([key]) => key.startsWith("lead-sessions/"))[1];
    assert.equal(JSON.parse(new TextDecoder().decode(storedSession.bytes)).state, "closed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("photo upload reports missing R2 or KV bindings without exposing secrets", async () => {
  const response = await uploadPhoto({
    request: new Request("https://www.allqualitygutters.com/api/upload-photo", { method: "POST" }),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: "photo_upload_not_configured",
    message: "Photo uploads are not configured yet.",
  });
});

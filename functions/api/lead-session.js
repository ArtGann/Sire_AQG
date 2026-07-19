const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors },
});

const clean = (value, max = 2048) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const MAX_PHOTO_SLOTS = 10;
const LEAD_SESSION_TTL = 1800;

function randomHex(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const sessionKey = async (id) => `lead-sessions/${await sha256(id)}.json`;
const sessionPhotoKey = async (id, slot) => `lead-session-photos/${await sha256(id)}/${slot}.json`;

const hasR2 = (env) => Boolean(
  env.LEAD_PHOTOS_BUCKET &&
  typeof env.LEAD_PHOTOS_BUCKET.get === "function" &&
  typeof env.LEAD_PHOTOS_BUCKET.put === "function"
);

async function readR2JsonObject(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  const text = typeof object.text === "function"
    ? await object.text()
    : await new Response(object.body).text();
  try {
    const value = JSON.parse(text);
    const etag = typeof object.etag === "string"
      ? object.etag
      : typeof object.httpEtag === "string"
        ? object.httpEtag.replace(/^"|"$/g, "")
        : "";
    return { value, etag };
  } catch {
    return null;
  }
}

async function readR2Json(bucket, key) {
  return (await readR2JsonObject(bucket, key))?.value || null;
}

async function writeR2Json(bucket, key, value, onlyIf = null) {
  const options = {
    httpMetadata: { contentType: "application/json", cacheControl: "no-store" },
    customMetadata: { source: "estimate-form-session" },
  };
  if (onlyIf) options.onlyIf = onlyIf;
  return bucket.put(key, JSON.stringify(value), options);
}

async function consumeCounter(kv, key, max, ttl) {
  const count = Number(await kv.get(key) || 0);
  if (count >= max) return false;
  await kv.put(key, String(count + 1), { expirationTtl: ttl });
  return true;
}

function expectedHostnames(env) {
  return clean(env.TURNSTILE_EXPECTED_HOSTNAMES, 500)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyTurnstileForSession(env, token, ip) {
  const secret = clean(env.TURNSTILE_SECRET_KEY);
  if (!secret) return { ok: env.TURNSTILE_ENFORCE !== "true", code: "turnstile_not_configured" };
  if (!token) return { ok: false, code: "missing_turnstile_token" };

  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: ip,
    idempotency_key: crypto.randomUUID(),
  });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) {
    return { ok: false, code: "turnstile_failed", errorCodes: result["error-codes"] || [] };
  }

  const hostnames = expectedHostnames(env);
  if (hostnames.length && !hostnames.includes(clean(result.hostname, 255).toLowerCase())) {
    return { ok: false, code: "turnstile_hostname_mismatch" };
  }

  const expectedAction = clean(env.TURNSTILE_EXPECTED_ACTION, 100);
  if (expectedAction && clean(result.action, 100) !== expectedAction) {
    return { ok: false, code: "turnstile_action_mismatch" };
  }

  return { ok: true, code: "turnstile_valid" };
}

export async function validateLeadSession(env, id, token) {
  const normalizedId = clean(id, 160);
  const normalizedToken = clean(token, 256);
  if (!hasR2(env)) {
    return { ok: false, status: 503, code: "lead_session_not_configured", message: "Secure lead submission is not configured yet." };
  }
  if (!normalizedId || !normalizedToken) {
    return { ok: false, status: 400, code: "invalid_lead_session", message: "Please refresh the form and try again." };
  }

  const storedSession = await readR2JsonObject(env.LEAD_PHOTOS_BUCKET, await sessionKey(normalizedId));
  const session = storedSession?.value;
  if (!session) return { ok: false, status: 400, code: "lead_session_expired", message: "Your security session expired. Please verify and try again." };
  if (Number(session.expires_at || 0) <= Date.now()) {
    return { ok: false, status: 400, code: "lead_session_expired", message: "Your security session expired. Please verify and try again." };
  }

  if (session.state !== "open") {
    return { ok: false, status: 409, code: "lead_session_closed", message: "This estimate request has already been submitted." };
  }
  if (session.token_hash !== await sha256(normalizedToken)) {
    return { ok: false, status: 400, code: "invalid_lead_session", message: "Please refresh the form and try again." };
  }

  return { ok: true, id: normalizedId, session, etag: storedSession.etag };
}

export async function saveLeadSession(env, id, session, ttl = LEAD_SESSION_TTL, onlyIf = null) {
  if (!hasR2(env)) throw new Error("Lead session storage is unavailable.");
  return writeR2Json(env.LEAD_PHOTOS_BUCKET, await sessionKey(id), { ...session, expires_at: Date.now() + ttl * 1000 }, onlyIf);
}

export async function saveLeadPhoto(env, id, slot, photo, ttl = LEAD_SESSION_TTL, onlyIf = null) {
  if (!hasR2(env) || !Number.isInteger(slot) || slot < 0 || slot >= MAX_PHOTO_SLOTS) {
    throw new Error("Invalid lead photo slot.");
  }
  return writeR2Json(env.LEAD_PHOTOS_BUCKET, await sessionPhotoKey(id, slot), { ...photo, expires_at: Date.now() + ttl * 1000 }, onlyIf);
}

export async function loadLeadPhotos(env, id, sessionGeneration = "") {
  if (!hasR2(env) || !id) return [];
  const values = await Promise.all(
    Array.from({ length: MAX_PHOTO_SLOTS }, async (_, slot) =>
      readR2Json(env.LEAD_PHOTOS_BUCKET, await sessionPhotoKey(id, slot))
    )
  );
  const now = Date.now();
  return values.flatMap((photo, slot) => {
    return typeof photo?.url === "string" && typeof photo?.object_key === "string" &&
      Number(photo.expires_at || 0) > now && photo.session_generation === sessionGeneration
      ? [{ ...photo, slot }]
      : [];
  });
}

export async function claimLeadSession(env, id, validatedSession) {
  if (!hasR2(env) || !id || !validatedSession?.session || !validatedSession.etag) return null;
  const session = {
    ...validatedSession.session,
    state: "submitting",
    submitting_at: new Date().toISOString(),
  };
  const stored = await saveLeadSession(env, id, session, LEAD_SESSION_TTL, { etagMatches: validatedSession.etag });
  if (!stored) return null;
  return { session, etag: stored.etag || stored.httpEtag?.replace(/^"|"$/g, "") || "" };
}

export async function reopenLeadSession(env, id, claim) {
  if (!hasR2(env) || !id || !claim?.session || !claim.etag) return false;
  const session = { ...claim.session, state: "open" };
  delete session.submitting_at;
  return Boolean(await saveLeadSession(env, id, session, LEAD_SESSION_TTL, { etagMatches: claim.etag }));
}

export async function closeLeadSession(env, id, session = {}, expectedEtag = "") {
  if (!hasR2(env) || !id) return;
  return saveLeadSession(
    env,
    id,
    { ...session, state: "closed", closed_at: new Date().toISOString() },
    86400,
    expectedEtag ? { etagMatches: expectedEtag } : null
  );
}

export async function onRequest({ request, env = {} } = {}) {
  try {
    if (!request) return json({ ok: false, code: "missing_request", message: "Security verification is unavailable." }, 500);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ ok: false, code: "method_not_allowed", message: "Method not allowed." }, 405);
    const uploadSecurityConfigured = env.TURNSTILE_ENFORCE === "true" &&
      Boolean(clean(env.TURNSTILE_SECRET_KEY)) &&
      expectedHostnames(env).length > 0 &&
      Boolean(clean(env.TURNSTILE_EXPECTED_ACTION, 100));
    if (!env.LEAD_RATE_LIMIT_KV || !hasR2(env) || !uploadSecurityConfigured) {
      return json({ ok: false, code: "lead_session_not_configured", message: "Secure photo uploads are not configured yet." }, 503);
    }

    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") return json({ ok: false, code: "invalid_json", message: "Please send a valid request." }, 400);

    const id = clean(payload.idempotency_key);
    const token = clean(payload.turnstile_token);
    const ip = request.headers.get("CF-Connecting-IP") || "";
    if (!id || id.length > 160) return json({ ok: false, code: "invalid_idempotency_key", message: "Please refresh the form and try again." }, 400);
    if (!(await consumeCounter(env.LEAD_RATE_LIMIT_KV, `lead-session-rate:${ip}`, 10, 600))) {
      return json({ ok: false, code: "rate_limited", message: "Please wait a few minutes before trying again." }, 429);
    }
    if (await env.LEAD_RATE_LIMIT_KV.get(`lead-idempotency:${id}`)) {
      return json({ ok: false, code: "already_submitted", message: "This estimate request has already been submitted." }, 409);
    }
    const existingSessionKey = await sessionKey(id);
    const existingSession = typeof env.LEAD_PHOTOS_BUCKET.head === "function"
      ? await env.LEAD_PHOTOS_BUCKET.head(existingSessionKey)
      : await env.LEAD_PHOTOS_BUCKET.get(existingSessionKey);
    if (existingSession) {
      return json({ ok: false, code: "lead_session_exists", message: "Please refresh the security verification and try again." }, 409);
    }

    const verification = await verifyTurnstileForSession(env, token, ip);
    if (!verification.ok) return json({ ok: false, code: verification.code, message: "Security verification failed. Please try again." }, 400);

    const sessionToken = randomHex(32);
    const session = {
      state: "open",
      token_hash: await sha256(sessionToken),
      created_at: new Date().toISOString(),
      request_ip: ip,
      generation: randomHex(32),
      photo_keys: Array.from({ length: MAX_PHOTO_SLOTS }, () => randomHex(32)),
    };
    const stored = await saveLeadSession(env, id, session, LEAD_SESSION_TTL, { etagDoesNotMatch: "*" });
    if (!stored) return json({ ok: false, code: "lead_session_exists", message: "Please refresh the security verification and try again." }, 409);

    return json({ ok: true, lead_session_token: sessionToken, event_id: id, expires_in: 1800 });
  } catch {
    return json({ ok: false, code: "unexpected_error", message: "Security verification failed. Please try again." }, 500);
  }
}

import "../../assets/js/estimate-core.js";

const core = globalThis.AQGEstimateCore;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
const clean = (value) => typeof value === "string" ? value.trim() : "";
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function normalize(payload, request) {
  return {
    raw: { ...payload, stories: payload.stories || payload.home_stories, service_needed: Array.isArray(payload.service_needed) ? payload.service_needed : [] },
    full_name: clean(payload.full_name), phone: clean(payload.phone), email: clean(payload.email), zip_code: clean(payload.zip_code), property_address: clean(payload.property_address), preferred_date: clean(payload.preferred_date), comments: clean(payload.comments),
    calculator_requested: payload.calculator_requested === true, idempotency_key: clean(payload.idempotency_key), website: clean(payload.website), turnstile_token: clean(payload.turnstile_token),
    uploaded_photos: Array.isArray(payload.uploaded_photos) ? payload.uploaded_photos : [], sms_consent: payload.sms_consent === true,
    landing_page_url: clean(payload.landing_page_url), referrer: clean(payload.referrer) || request.headers.get("Referer") || "", request_ip: request.headers.get("CF-Connecting-IP") || "", user_agent: request.headers.get("User-Agent") || ""
  };
}
async function consumeKvCounter(kv, key, max, ttl) { if (!kv) return true; const count = Number(await kv.get(key) || 0); if (count >= max) return false; await kv.put(key, String(count + 1), { expirationTtl: ttl }); return true; }
async function verifyTurnstile(env, token, ip) { if (!env.TURNSTILE_SECRET_KEY) return env.TURNSTILE_ENFORCE !== "true"; if (!token) return false; const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }); const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body }); const result = await response.json().catch(() => ({})); return response.ok && result.success === true; }
function allowedPhotoUrls(urls, base) {
  if (!Array.isArray(urls) || urls.length > core.MAX_PHOTOS) return false;
  if (urls.length === 0) return true;
  if (!base) return false;
  let trusted;
  try { trusted = new URL(base); } catch { return false; }
  return urls.every((value) => {
    try { const url = new URL(value); return url.protocol === trusted.protocol && url.hostname === trusted.hostname && url.pathname.startsWith(trusted.pathname.replace(/\/$/, "") + "/"); } catch { return false; }
  });
}

export async function onRequest({ request, env = {} } = {}) {
  try {
    if (!request) return json({ ok: false, code: "missing_request", message: "We couldn't send your estimate request." }, 500);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ ok: false, code: "method_not_allowed", message: "Method not allowed." }, 405);
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") return json({ ok: false, code: "invalid_json", message: "Please send a valid estimate request." }, 400);
    const lead = normalize(payload, request);
    if (lead.website) return json({ ok: true, estimate_status: "not_requested", customer_display_estimate: 0 });
    if (!(await consumeKvCounter(env.LEAD_RATE_LIMIT_KV, `lead-rate:${lead.request_ip}`, 5, 600))) return json({ ok: false, code: "rate_limited", message: "Please wait a few minutes before trying again." }, 429);
    if (!lead.full_name || !lead.phone || !validEmail(lead.email) || !/^\d{5}$/.test(lead.zip_code) || !lead.property_address || !lead.raw.service_needed.length) return json({ ok: false, code: "invalid_contact", message: "Please complete all required request fields with a valid 5-digit ZIP code." }, 400);
    if (lead.preferred_date && !core.validDate(lead.preferred_date)) return json({ ok: false, code: "invalid_date", message: "Please choose a future Monday through Saturday appointment date." }, 400);
    if (!lead.idempotency_key || lead.idempotency_key.length > 160) return json({ ok: false, code: "invalid_idempotency_key", message: "Please refresh the form and try again." }, 400);
    const idempotencyKey = `lead-idempotency:${lead.idempotency_key}`;
    if (env.LEAD_RATE_LIMIT_KV && await env.LEAD_RATE_LIMIT_KV.get(idempotencyKey)) return json({ ok: true, duplicate: true, estimate_status: "not_requested", customer_display_estimate: 0 });
    if (!(await verifyTurnstile(env, lead.turnstile_token, lead.request_ip))) return json({ ok: false, code: "turnstile_failed", message: "Security verification failed. Please try again." }, 400);
    if (!allowedPhotoUrls(lead.uploaded_photos, env.R2_PUBLIC_BASE_URL)) return json({ ok: false, code: "invalid_photos", message: "Photo URLs must come from the configured project storage." }, 400);
    const estimate = core.calculate({ ...lead.raw, calculator_requested: lead.calculator_requested });
    if (estimate.estimateStatus === "invalid") return json({ ok: false, code: "invalid_estimate", message: estimate.errors[0] || "Complete the calculator fields or choose I'm not sure.", errors: estimate.errors }, 400);
    const webhook = clean(env.GHL_WEBHOOK_URL);
    if (!/^https:\/\//.test(webhook)) return json({ ok: false, code: "missing_webhook_url", message: "Lead delivery is not configured yet. Please call us or try again later." }, 500);
    const input = estimate.input;
    const now = new Date().toISOString();
    const serviceAreaStatus = core.serviceAreaStatus(lead.zip_code, clean(env.SUPPORTED_ZIPS).split(",").map((zip) => zip.trim()).filter(Boolean));
    const ghl = {
      full_name: lead.full_name, phone: lead.phone, email: lead.email, zip_code: lead.zip_code, property_address: lead.property_address, service_needed: input.services, preferred_date: lead.preferred_date, comments: lead.comments,
      calculator_requested: lead.calculator_requested, estimate_status: estimate.estimateStatus, estimate_version: "3", estimate_base_total: estimate.baseTotal, estimate_low: estimate.low, estimate_high: estimate.high, estimated_price_low: estimate.low, estimated_price_high: estimate.high, estimated_price_range: estimate.range, customer_display_estimate: estimate.customerDisplayEstimate, estimate_requires_manual_review: estimate.requiresManualReview, estimate_details: estimate.estimateDetails,
      gutter_size: input.size, gutter_type: input.size ? `${input.size}\" Aluminum K-Style` : "", gutter_mode: "whole_home_estimate", gutter_lf: estimate.estimatedGutterLf || 0, gutter_linear_feet: estimate.estimatedGutterLf || 0, gutter_lf_source: input.included.gutters ? "estimated_from_home_size" : "",
      guard_type: input.guardType, gutter_guards: input.guardType, guard_mode: input.included.guards ? "whole_home_estimate" : "", guard_lf: input.included.guards ? estimate.estimatedGutterLf : 0, gutter_guard_linear_feet: input.included.guards ? estimate.estimatedGutterLf : 0, guard_lf_source: input.included.guards ? "based_on_gutter_system_length" : "",
      fascia_mode: input.included.fascia ? "whole_home_estimate" : "", fascia_lf: input.included.fascia ? estimate.estimatedGutterLf : 0, fascia_linear_feet: input.included.fascia ? estimate.estimatedGutterLf : 0, fascia_lf_source: input.included.fascia ? "estimated_from_home_size" : "", soffit_mode: input.included.soffit ? "whole_home_estimate" : "", soffit_lf: input.included.soffit ? estimate.estimatedGutterLf : 0, soffit_linear_feet: input.included.soffit ? estimate.estimatedGutterLf : 0, soffit_lf_source: input.included.soffit ? "estimated_from_home_size" : "",
      home_stories: input.stories || "", square_feet: input.squareFeet || "", downspout_count: input.downspoutCount, downspout_length_per_unit: input.stories ? input.stories * 10 : "", downspout_total_lf: input.downspoutCount * (input.stories ? input.stories * 10 : 0), elbow_count: input.downspoutCount * 3, connector_count: input.included.connectors ? input.downspoutCount : 0, downspout_connector_count: input.included.connectors ? input.downspoutCount : 0, miter_count: input.miterCount, gutter_miter_count: input.miterCount,
      estimate_inputs_json: JSON.stringify(input), estimate_line_items_json: JSON.stringify(estimate.lineItems), estimate_line_items: estimate.lineItems,
      uploaded_photos: lead.uploaded_photos, uploaded_photos_text: lead.uploaded_photos.join("\n"), service_area_status: serviceAreaStatus,
      landing_page: lead.landing_page_url, landing_page_url: lead.landing_page_url, referrer: lead.referrer, utm_source: clean(payload.utm_source), utm_medium: clean(payload.utm_medium), utm_campaign: clean(payload.utm_campaign), utm_content: clean(payload.utm_content), utm_term: clean(payload.utm_term), gclid: clean(payload.gclid), fbclid: clean(payload.fbclid),
      sms_consent: lead.sms_consent, sms_consent_timestamp: lead.sms_consent ? now : "", sms_consent_text_version: lead.sms_consent ? "2026-07-11" : "", submission_timestamp: now, idempotency_key: lead.idempotency_key, request_ip: lead.request_ip, user_agent: lead.user_agent, page_form_source: "Website Estimate Form"
    };
    const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ghl) });
    if (!response.ok) return json({ ok: false, code: "ghl_not_ok", message: "We couldn't send your estimate request. Please try again or call us." }, 502);
    if (env.LEAD_RATE_LIMIT_KV) { await env.LEAD_RATE_LIMIT_KV.put(idempotencyKey, "1", { expirationTtl: 86400 }); await env.LEAD_RATE_LIMIT_KV.put(`upload-session:${lead.idempotency_key}`, "closed", { expirationTtl: 86400 }); }
    return json({ ok: true, estimate_status: estimate.estimateStatus, customer_display_estimate: estimate.customerDisplayEstimate, estimate_requires_manual_review: estimate.requiresManualReview });
  } catch { return json({ ok: false, code: "unexpected_error", message: "We couldn't send your estimate request. Please try again or call us." }, 500); }
}

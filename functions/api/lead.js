import "../../assets/js/estimate-core.js";
import { claimLeadSession, closeLeadSession, loadLeadPhotos, reopenLeadSession, validateLeadSession, verifyTurnstileForSession } from "./lead-session.js";

const core = globalThis.AQGEstimateCore;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
const clean = (value) => typeof value === "string" ? value.trim() : "";
const bounded = (value, max) => clean(value).slice(0, max);
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const campaignFields = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "gbraid", "wbraid", "msclkid"];
const allowedServices = new Set([
  "Seamless Gutter Installation",
  "Gutter Guards",
  "Gutter Replacement",
  "Soffit & Fascia",
  "Downspout Installation",
  "Gutter Miters & Connectors",
]);

function normalizeUsPhone(value) {
  const digits = clean(value).replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return national.length === 10 ? `+1${national}` : "";
}

function normalizeServices(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => bounded(item, 80)).filter((item) => allowedServices.has(item)))].slice(0, 6);
}

function normalizePhotoUrls(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > core.MAX_PHOTOS) return null;
  const urls = value.map((item) => typeof item === "string" ? item.trim() : "");
  if (urls.some((url) => !url || url.length > 1000) || new Set(urls).size !== urls.length) return null;
  return urls;
}

function safeUrl(value) {
  try {
    const url = new URL(bounded(value, 1000));
    if (!/^https?:$/.test(url.protocol)) return "";
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return "";
  }
}

function normalizeAttribution(payload) {
  const result = {
    landing_page_url: safeUrl(payload.landing_page_url),
    referrer: safeUrl(payload.referrer),
    first_landing_page_url: safeUrl(payload.first_landing_page_url),
    first_referrer: safeUrl(payload.first_referrer),
    first_touch_timestamp: bounded(payload.first_touch_timestamp, 40),
    last_landing_page_url: safeUrl(payload.last_landing_page_url),
    last_referrer: safeUrl(payload.last_referrer),
    last_touch_timestamp: bounded(payload.last_touch_timestamp, 40),
    session_id: bounded(payload.session_id, 100),
    session_started_at: bounded(payload.session_started_at, 40),
    session_landing_page_url: safeUrl(payload.session_landing_page_url),
    session_referrer: safeUrl(payload.session_referrer),
    page_url: safeUrl(payload.page_url),
    page_path: bounded(payload.page_path, 300),
    page_title: bounded(payload.page_title, 200),
    cta_location: bounded(payload.cta_location, 120),
  };
  campaignFields.forEach((field) => {
    const limit = field.endsWith("clid") ? 256 : 200;
    result[field] = bounded(payload[field], limit);
    result[`first_${field}`] = bounded(payload[`first_${field}`], limit);
    result[`last_${field}`] = bounded(payload[`last_${field}`], limit);
  });
  return result;
}

function normalize(payload, request) {
  const attribution = normalizeAttribution(payload);
  if (!attribution.referrer) attribution.referrer = safeUrl(request.headers.get("Referer") || "");
  const services = normalizeServices(payload.service_needed);
  const uploadedPhotos = normalizePhotoUrls(payload.uploaded_photos);
  return {
    raw: { ...payload, stories: payload.stories || payload.home_stories, service_needed: services },
    full_name: bounded(payload.full_name, 120), phone: normalizeUsPhone(payload.phone), email: bounded(payload.email, 254), zip_code: bounded(payload.zip_code, 5), property_address: bounded(payload.property_address, 300), preferred_date: bounded(payload.preferred_date, 10), comments: bounded(payload.comments, 3000),
    calculator_requested: payload.calculator_requested === true, idempotency_key: bounded(payload.idempotency_key, 160), website: bounded(payload.website, 200), turnstile_token: bounded(payload.turnstile_token, 2048), lead_session_token: bounded(payload.lead_session_token, 256),
    uploaded_photos: uploadedPhotos, sms_consent: payload.sms_consent === true,
    attribution, request_ip: bounded(request.headers.get("CF-Connecting-IP") || "", 64), user_agent: bounded(request.headers.get("User-Agent") || "", 500)
  };
}
async function consumeKvCounter(kv, key, max, ttl) { if (!kv) return true; const count = Number(await kv.get(key) || 0); if (count >= max) return false; await kv.put(key, String(count + 1), { expirationTtl: ttl }); return true; }

export async function onRequest({ request, env = {} } = {}) {
  try {
    if (!request) return json({ ok: false, code: "missing_request", message: "We couldn't send your estimate request." }, 500);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ ok: false, code: "method_not_allowed", message: "Method not allowed." }, 405);
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") return json({ ok: false, code: "invalid_json", message: "Please send a valid estimate request." }, 400);
    const lead = normalize(payload, request);
    if (lead.website) return json({ ok: true, estimate_status: "not_requested", customer_display_estimate: 0 });
    if (lead.uploaded_photos === null) return json({ ok: false, code: "invalid_photos", message: "Please attach no more than 10 valid project photos." }, 400);
    if (!(await consumeKvCounter(env.LEAD_RATE_LIMIT_KV, `lead-rate:${lead.request_ip}`, 5, 600))) return json({ ok: false, code: "rate_limited", message: "Please wait a few minutes before trying again." }, 429);
    if (lead.full_name.length < 2 || !lead.phone || !validEmail(lead.email) || !/^\d{5}$/.test(lead.zip_code) || !lead.property_address || !lead.raw.service_needed.length) return json({ ok: false, code: "invalid_contact", message: "Please complete all required request fields with a valid 10-digit phone number and 5-digit ZIP code." }, 400);
    if (lead.preferred_date && !core.validDate(lead.preferred_date)) return json({ ok: false, code: "invalid_date", message: "Please choose a future Monday through Saturday appointment date." }, 400);
    if (!lead.idempotency_key || lead.idempotency_key.length > 160) return json({ ok: false, code: "invalid_idempotency_key", message: "Please refresh the form and try again." }, 400);
    const idempotencyKey = `lead-idempotency:${lead.idempotency_key}`;
    if (env.LEAD_RATE_LIMIT_KV && await env.LEAD_RATE_LIMIT_KV.get(idempotencyKey)) return json({ ok: true, duplicate: true, event_id: lead.idempotency_key, estimate_status: "not_requested", customer_display_estimate: 0 });
    if (lead.uploaded_photos.length && !lead.lead_session_token) {
      return json({ ok: false, code: "invalid_photos", message: "Photo URLs require a verified upload session." }, 400);
    }
    let leadSession = null;
    if (lead.lead_session_token) {
      leadSession = await validateLeadSession(env, lead.idempotency_key, lead.lead_session_token);
      if (!leadSession.ok) return json({ ok: false, code: leadSession.code, message: leadSession.message }, leadSession.status);
    } else {
      const verification = await verifyTurnstileForSession(env, lead.turnstile_token, lead.request_ip);
      if (!verification.ok) return json({ ok: false, code: verification.code, message: "Security verification failed. Please try again." }, 400);
    }
    if (lead.uploaded_photos.length) {
      const storedPhotos = await loadLeadPhotos(env, lead.idempotency_key, leadSession.session.generation);
      const allowedUrls = new Set(storedPhotos.map((photo) => photo.url));
      if (!lead.uploaded_photos.every((url) => allowedUrls.has(url))) {
        return json({ ok: false, code: "invalid_photos", message: "Photo URLs must come from this verified estimate session." }, 400);
      }
    }
    const estimate = core.calculate({ ...lead.raw, calculator_requested: lead.calculator_requested });
    if (estimate.estimateStatus === "invalid") return json({ ok: false, code: "invalid_estimate", message: estimate.errors[0] || "Complete the calculator fields or choose I'm not sure.", errors: estimate.errors }, 400);
    const webhook = clean(env.GHL_WEBHOOK_URL);
    if (!/^https:\/\//.test(webhook)) return json({ ok: false, code: "missing_webhook_url", message: "Lead delivery is not configured yet. Please call us or try again later." }, 500);
    const input = estimate.input;
    const now = new Date().toISOString();
    const configuredSupportedZips = clean(env.SUPPORTED_ZIPS).split(",").map((zip) => zip.trim()).filter((zip) => /^\d{5}$/.test(zip));
    const serviceAreaStatus = core.serviceAreaStatus(lead.zip_code, configuredSupportedZips);
    const attribution = lead.attribution;
    const ghl = {
      full_name: lead.full_name, phone: lead.phone, email: lead.email, zip_code: lead.zip_code, property_address: lead.property_address, service_needed: input.services, preferred_date: lead.preferred_date, comments: lead.comments,
      calculator_requested: lead.calculator_requested, estimate_status: estimate.estimateStatus, estimate_version: "3", estimate_base_total: estimate.baseTotal, estimate_low: estimate.low, estimate_high: estimate.high, estimated_price_low: estimate.low, estimated_price_high: estimate.high, estimated_price_range: estimate.range, customer_display_estimate: estimate.customerDisplayEstimate, estimate_requires_manual_review: estimate.requiresManualReview, estimate_details: estimate.estimateDetails,
      gutter_size: input.size, gutter_type: input.size ? `${input.size}\" Aluminum K-Style` : "", gutter_mode: "whole_home_estimate", gutter_lf: estimate.estimatedGutterLf || 0, gutter_linear_feet: estimate.estimatedGutterLf || 0, gutter_lf_source: input.included.gutters ? "estimated_from_home_size" : "",
      guard_type: input.guardType, gutter_guards: input.guardType, guard_mode: input.included.guards ? "whole_home_estimate" : "", guard_lf: input.included.guards ? estimate.estimatedGutterLf : 0, gutter_guard_linear_feet: input.included.guards ? estimate.estimatedGutterLf : 0, guard_lf_source: input.included.guards ? "based_on_gutter_system_length" : "",
      fascia_mode: input.included.fascia ? "whole_home_estimate" : "", fascia_lf: input.included.fascia ? estimate.estimatedGutterLf : 0, fascia_linear_feet: input.included.fascia ? estimate.estimatedGutterLf : 0, fascia_lf_source: input.included.fascia ? "estimated_from_home_size" : "", soffit_mode: input.included.soffit ? "whole_home_estimate" : "", soffit_lf: input.included.soffit ? estimate.estimatedGutterLf : 0, soffit_linear_feet: input.included.soffit ? estimate.estimatedGutterLf : 0, soffit_lf_source: input.included.soffit ? "estimated_from_home_size" : "",
      home_stories: input.stories || "", square_feet: input.squareFeet || "", downspout_count: input.downspoutCount, downspout_length_per_unit: input.stories ? input.stories * 10 : "", downspout_total_lf: input.downspoutCount * (input.stories ? input.stories * 10 : 0), elbow_count: input.downspoutCount * 3, connector_count: input.included.connectors ? input.downspoutCount : 0, downspout_connector_count: input.included.connectors ? input.downspoutCount : 0, miter_count: input.miterCount, gutter_miter_count: input.miterCount,
      estimate_inputs_json: JSON.stringify(input), estimate_line_items_json: JSON.stringify(estimate.lineItems), estimate_line_items: estimate.lineItems,
      uploaded_photos: lead.uploaded_photos, uploaded_photos_text: lead.uploaded_photos.join("\n"), service_area_status: serviceAreaStatus,
      landing_page: attribution.first_landing_page_url || attribution.landing_page_url, ...attribution, attribution_json: JSON.stringify(attribution),
      sms_consent: lead.sms_consent, sms_consent_timestamp: lead.sms_consent ? now : "", sms_consent_text_version: lead.sms_consent ? "2026-07-11" : "", submission_timestamp: now, idempotency_key: lead.idempotency_key, event_id: lead.idempotency_key, request_ip: lead.request_ip, user_agent: lead.user_agent, page_form_source: "Website Estimate Form"
    };
    const sessionClaim = leadSession ? await claimLeadSession(env, lead.idempotency_key, leadSession) : null;
    if (leadSession && !sessionClaim) {
      return json({ ok: false, code: "lead_session_closed", message: "This estimate request is already being submitted." }, 409);
    }
    let response;
    try {
      response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ghl) });
    } catch (error) {
      if (sessionClaim) await reopenLeadSession(env, lead.idempotency_key, sessionClaim).catch(() => false);
      throw error;
    }
    if (!response.ok) {
      if (sessionClaim) await reopenLeadSession(env, lead.idempotency_key, sessionClaim).catch(() => false);
      return json({ ok: false, code: "ghl_not_ok", message: "We couldn't send your estimate request. Please try again or call us." }, 502);
    }
    let deliveryStateSaved = true;
    if (sessionClaim) {
      try {
        const closed = await closeLeadSession(env, lead.idempotency_key, sessionClaim.session, sessionClaim.etag);
        if (!closed) deliveryStateSaved = false;
      } catch { deliveryStateSaved = false; }
    }
    if (env.LEAD_RATE_LIMIT_KV) {
      try { await env.LEAD_RATE_LIMIT_KV.put(idempotencyKey, "1", { expirationTtl: 86400 }); }
      catch { deliveryStateSaved = false; }
    }
    return json({ ok: true, event_id: lead.idempotency_key, currency: "USD", estimate_status: estimate.estimateStatus, customer_display_estimate: estimate.customerDisplayEstimate, estimate_requires_manual_review: estimate.requiresManualReview, delivery_state_saved: deliveryStateSaved });
  } catch { return json({ ok: false, code: "unexpected_error", message: "We couldn't send your estimate request. Please try again or call us." }, 500); }
}

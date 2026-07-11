import "../../assets/js/estimate-core.js";

const core = globalThis.AQGEstimateCore;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
const clean = (value) => typeof value === "string" ? value.trim() : "";
const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
async function verifyTurnstile(env, token, ip) { if (!env.TURNSTILE_SECRET_KEY) return env.TURNSTILE_ENFORCE !== "true"; if (!token) return false; const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }); const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body }); const result = await response.json().catch(() => ({})); return response.ok && result.success === true; }
export async function hasValidImageMagic(file) { const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer()); const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff; const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte); const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"; return (file.type === "image/jpeg" && jpeg) || (file.type === "image/png" && png) || (file.type === "image/webp" && webp); }

export async function onRequestPost({ request, env = {} }) {
  if (!env.LEAD_PHOTOS_BUCKET || !env.R2_PUBLIC_BASE_URL || !env.LEAD_RATE_LIMIT_KV) return json({ ok: false, message: "Photo uploads are not configured yet." }, 503);
  const form = await request.formData().catch(() => null); const photo = form?.get("photo"); const id = clean(form?.get("idempotency_key")); const token = clean(form?.get("turnstile_token")); const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!(photo instanceof File) || !id || id.length > 160) return json({ ok: false, message: "Please start a valid estimate request before uploading photos." }, 400);
  if (!(await verifyTurnstile(env, token, ip))) return json({ ok: false, message: "Security verification failed. Please try again." }, 400);
  if (!(await hasValidImageMagic(photo)) || !extension[photo.type] || core.validatePhotoMeta([photo])) return json({ ok: false, message: "Photos must be valid JPG, PNG, or WEBP files up to 10MB each." }, 400);
  const sessionKey = `upload-session:${id}`; const state = await env.LEAD_RATE_LIMIT_KV.get(sessionKey); if (state === "closed") return json({ ok: false, message: "This upload session is closed." }, 409); const count = Number(state || 0); if (count >= core.MAX_PHOTOS) return json({ ok: false, message: "You can upload up to 6 photos." }, 400);
  if (Number(await env.LEAD_RATE_LIMIT_KV.get(`upload-rate:${ip}`) || 0) >= 12) return json({ ok: false, message: "Please wait before uploading more photos." }, 429);
  await env.LEAD_RATE_LIMIT_KV.put(sessionKey, String(count + 1), { expirationTtl: 1800 }); await env.LEAD_RATE_LIMIT_KV.put(`upload-rate:${ip}`, String(Number(await env.LEAD_RATE_LIMIT_KV.get(`upload-rate:${ip}`) || 0) + 1), { expirationTtl: 600 });
  const key = `leads/${id}/${crypto.randomUUID()}.${extension[photo.type]}`; await env.LEAD_PHOTOS_BUCKET.put(key, photo.stream(), { httpMetadata: { contentType: photo.type } });
  return json({ ok: true, url: `${String(env.R2_PUBLIC_BASE_URL).replace(/\/$/, "")}/${key}` });
}

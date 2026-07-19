import "../../assets/js/estimate-core.js";
import { loadLeadPhotos, MAX_PHOTO_SLOTS, saveLeadPhoto, validateLeadSession } from "./lead-session.js";

const core = globalThis.AQGEstimateCore;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});
const clean = (value) => typeof value === "string" ? value.trim() : "";
const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_MULTIPART_BYTES = core.MAX_PHOTO_BYTES + 1024 * 1024;

export async function hasValidImageMagic(file) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    .every((byte, index) => bytes[index] === byte);
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return (file.type === "image/jpeg" && jpeg) ||
    (file.type === "image/png" && png) ||
    (file.type === "image/webp" && webp);
}

function photoSlot(value) {
  const normalized = clean(value);
  if (!/^\d{1,2}$/.test(normalized)) return -1;
  const slot = Number(normalized);
  return Number.isInteger(slot) && slot >= 0 && slot < MAX_PHOTO_SLOTS ? slot : -1;
}

function publicPhotoId(session, slot) {
  const publicId = clean(session?.photo_keys?.[slot]);
  return /^[a-f0-9]{64}$/.test(publicId) ? publicId : "";
}

function publicPhotoUrl(request, publicId) {
  const url = new URL(request.url);
  const isLocal = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
  if (url.protocol !== "https:" && !isLocal) return "";
  url.pathname = `/api/photo/${publicId}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function consumeUploadRate(kv, ip) {
  const key = `upload-rate:${ip || "unknown"}`;
  const count = Number(await kv.get(key) || 0);
  if (count >= 20) return false;
  await kv.put(key, String(count + 1), { expirationTtl: 600 });
  return true;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function receiptMatches(photo, expected) {
  return photo?.slot === expected.slot &&
    photo.url === expected.url &&
    photo.object_key === expected.object_key &&
    photo.content_type === expected.content_type &&
    photo.size === expected.size &&
    photo.sha256 === expected.sha256;
}

async function findMatchingReceipt(env, id, generation, expected) {
  const photos = await loadLeadPhotos(env, id, generation);
  return photos.find((photo) => receiptMatches(photo, expected)) || null;
}

export async function onRequestPost({ request, env = {} }) {
  if (!env.LEAD_PHOTOS_BUCKET || typeof env.LEAD_PHOTOS_BUCKET.get !== "function" || typeof env.LEAD_PHOTOS_BUCKET.put !== "function" || !env.LEAD_RATE_LIMIT_KV) {
    return json({
      ok: false,
      code: "photo_upload_not_configured",
      message: "Photo uploads are not configured yet.",
    }, 503);
  }

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_MULTIPART_BYTES) {
    return json({ ok: false, code: "photo_too_large", message: "Each photo must be 10MB or smaller." }, 413);
  }

  const form = await request.formData().catch(() => null);
  const photo = form?.get("photo");
  const id = clean(form?.get("idempotency_key"));
  const sessionToken = clean(form?.get("lead_session_token"));
  const slot = photoSlot(form?.get("photo_slot"));
  const ip = request.headers.get("CF-Connecting-IP") || "";

  if (!(photo instanceof File) || !id || id.length > 160 || !sessionToken || slot < 0) {
    return json({
      ok: false,
      code: "invalid_photo_request",
      message: "Please start a valid estimate request before uploading photos.",
    }, 400);
  }

  const validation = await validateLeadSession(env, id, sessionToken);
  if (!validation.ok) {
    return json({ ok: false, code: validation.code, message: validation.message }, validation.status);
  }

  if (!extension[photo.type] || core.validatePhotoMeta([photo]) || !(await hasValidImageMagic(photo))) {
    return json({
      ok: false,
      code: "invalid_photo",
      message: "Photos must be valid JPG, PNG, or WEBP files up to 10MB each.",
    }, 400);
  }

  if (!(await consumeUploadRate(env.LEAD_RATE_LIMIT_KV, ip))) {
    return json({ ok: false, code: "photo_rate_limited", message: "Please wait before uploading more photos." }, 429);
  }

  const publicId = publicPhotoId(validation.session, slot);
  const url = publicPhotoUrl(request, publicId);
  if (!publicId || !url) {
    return json({
      ok: false,
      code: "invalid_photo_session",
      message: "Your photo upload session expired. Please verify and try again.",
    }, 400);
  }

  const objectKey = `lead-photos/${publicId}`;
  try {
    const photoBytes = await photo.arrayBuffer();
    const photoSha256 = await sha256Hex(photoBytes);
    const receipt = {
      slot,
      url,
      object_key: objectKey,
      content_type: photo.type,
      size: photo.size,
      sha256: photoSha256,
      uploaded_at: new Date().toISOString(),
      session_generation: validation.session.generation,
    };
    const storedObject = await env.LEAD_PHOTOS_BUCKET.put(objectKey, photoBytes, {
      onlyIf: { etagDoesNotMatch: "*" },
      httpMetadata: {
        contentType: photo.type,
        contentDisposition: `inline; filename="project-photo.${extension[photo.type]}"`,
        cacheControl: "private, max-age=3600",
      },
      customMetadata: { source: "estimate-form", sha256: photoSha256 },
    });
    if (!storedObject) {
      if (await findMatchingReceipt(env, id, validation.session.generation, receipt)) {
        return json({ ok: true, url, slot, duplicate: true });
      }
      const existingObject = typeof env.LEAD_PHOTOS_BUCKET.head === "function"
        ? await env.LEAD_PHOTOS_BUCKET.head(objectKey)
        : await env.LEAD_PHOTOS_BUCKET.get(objectKey);
      const sameStoredObject = existingObject?.customMetadata?.sha256 === photoSha256 &&
        existingObject?.httpMetadata?.contentType === photo.type;
      if (sameStoredObject) {
        const recoveredReceipt = await saveLeadPhoto(env, id, slot, receipt, undefined, { etagDoesNotMatch: "*" });
        if (recoveredReceipt || await findMatchingReceipt(env, id, validation.session.generation, receipt)) {
          return json({ ok: true, url, slot, duplicate: true });
        }
      }
      return json({
        ok: false,
        code: "photo_slot_used",
        message: "That photo slot has already been uploaded. Please refresh the form and try again.",
      }, 409);
    }
    const storedReceipt = await saveLeadPhoto(env, id, slot, receipt, undefined, { etagDoesNotMatch: "*" });
    if (!storedReceipt && !(await findMatchingReceipt(env, id, validation.session.generation, receipt))) {
      return json({
        ok: false,
        code: "photo_slot_used",
        message: "That photo slot has already been uploaded. Please refresh the form and try again.",
      }, 409);
    }
  } catch {
    return json({
      ok: false,
      code: "photo_storage_error",
      message: "We couldn't store that photo. Please try again.",
    }, 502);
  }

  return json({ ok: true, url, slot });
}

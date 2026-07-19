const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const text = (message, status, extraHeaders = {}) => new Response(message, {
  status,
  headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  },
});

export async function onRequest({ request, env = {}, params = {} }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return text("Method not allowed.", 405, { Allow: "GET, HEAD" });
  }
  if (!env.LEAD_PHOTOS_BUCKET || typeof env.LEAD_PHOTOS_BUCKET.get !== "function") {
    return text("Photo storage is unavailable.", 503);
  }

  const photoId = typeof params.photoId === "string" ? params.photoId.trim() : "";
  if (!/^[a-f0-9]{64}$/.test(photoId)) return text("Photo not found.", 404);

  const objectKey = `lead-photos/${photoId}`;
  const object = request.method === "HEAD" && typeof env.LEAD_PHOTOS_BUCKET.head === "function"
    ? await env.LEAD_PHOTOS_BUCKET.head(objectKey)
    : await env.LEAD_PHOTOS_BUCKET.get(objectKey);
  if (!object) return text("Photo not found.", 404);

  const contentType = object.httpMetadata?.contentType || "";
  if (!allowedTypes.has(contentType)) return text("Photo not found.", 404);

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": object.httpMetadata?.contentDisposition || "inline",
    "Cache-Control": object.httpMetadata?.cacheControl || "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  if (object.httpEtag) headers.set("ETag", object.httpEtag);

  return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
}

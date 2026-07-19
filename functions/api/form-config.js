export function onRequestGet({ env = {} }) {
  const publicId = (value, pattern) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    return pattern.test(normalized) ? normalized : "";
  };

  return new Response(JSON.stringify({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",
    turnstileAction: publicId(env.TURNSTILE_EXPECTED_ACTION || "estimate_request", /^[A-Z0-9_-]{1,32}$/i),
    gtmContainerId: publicId(env.GTM_CONTAINER_ID, /^GTM-[A-Z0-9]+$/i),
    ga4MeasurementId: publicId(env.GA4_MEASUREMENT_ID, /^G-[A-Z0-9]+$/i),
    googleAdsId: publicId(env.GOOGLE_ADS_ID, /^AW-\d+$/i),
  }), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

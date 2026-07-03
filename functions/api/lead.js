const REQUIRED_FIELDS = [
  "full_name",
  "phone",
  "email",
  "zip_code",
  "service_needed",
  "property_address",
  "sms_consent"
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders
    }
  });

const cleanString = (value) => (typeof value === "string" ? value.trim() : "");

const normalizePayload = (payload, request) => {
  const services = Array.isArray(payload.service_needed)
    ? payload.service_needed.map(cleanString).filter(Boolean)
    : [];

  return {
    full_name: cleanString(payload.full_name),
    phone: cleanString(payload.phone),
    email: cleanString(payload.email),
    zip_code: cleanString(payload.zip_code),
    service_needed: services,
    home_stories: cleanString(payload.home_stories),
    square_feet: cleanString(payload.square_feet),
    property_address: cleanString(payload.property_address),
    preferred_date: cleanString(payload.preferred_date),
    comments: cleanString(payload.comments),
    uploaded_photos: "",
    sms_consent: payload.sms_consent === true,
    landing_page_url: cleanString(payload.landing_page_url) || request.headers.get("Referer") || "",
    page_form_source: "Website Estimate Form"
  };
};

const getMissingFields = (payload) =>
  REQUIRED_FIELDS.filter((field) => {
    const value = payload[field];
    return Array.isArray(value) ? value.length === 0 : !value;
  });

export async function onRequest(context) {
  try {
    const { request, env } = context || {};

    if (!request) {
      return jsonResponse(
        {
          ok: false,
          message: "We couldn't send your estimate request. Please try again or call us.",
          error_code: "missing_request"
        },
        500
      );
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
    }

    let incomingPayload;

    try {
      incomingPayload = await request.json();
    } catch {
      return jsonResponse({ ok: false, message: "Please send a valid estimate request." }, 400);
    }

    const leadPayload = normalizePayload(incomingPayload, request);
    const missingFields = getMissingFields(leadPayload);

    if (missingFields.length > 0) {
      return jsonResponse(
        {
          ok: false,
          message: "Please complete the required fields before sending.",
          missing_fields: missingFields
        },
        400
      );
    }

    const webhookUrl = String(env?.GHL_WEBHOOK_URL || "").trim();

    if (!webhookUrl) {
      return jsonResponse(
        {
          ok: false,
          message: "Lead delivery is not configured yet. Please call us or try again later.",
          error_code: "missing_webhook_url"
        },
        500
      );
    }

    if (!webhookUrl.startsWith("https://")) {
      return jsonResponse(
        {
          ok: false,
          message: "Lead delivery is misconfigured. Please call us or try again later.",
          error_code: "invalid_webhook_url"
        },
        500
      );
    }

    let ghlResponse;

    try {
      ghlResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(leadPayload)
      });
    } catch {
      return jsonResponse(
        {
          ok: false,
          message: "We couldn't send your estimate request. Please try again or call us.",
          error_code: "ghl_fetch_failed"
        },
        502
      );
    }

    if (!ghlResponse.ok) {
      return jsonResponse(
        {
          ok: false,
          message: "We couldn't send your estimate request. Please try again or call us.",
          error_code: "ghl_not_ok",
          status: ghlResponse.status
        },
        502
      );
    }

    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse(
      {
        ok: false,
        message: "We couldn't send your estimate request. Please try again or call us.",
        error_code: "unexpected_error"
      },
      500
    );
  }
}

(function () {
  const container = document.querySelector("[data-thank-you-estimate]");
  if (!container) return;
  let result = null;
  try { result = JSON.parse(sessionStorage.getItem("aqg_submission_result") || "null"); } catch { result = null; }
  sessionStorage.removeItem("aqg_submission_result");
  if (!result) return;

  const analytics = result.analytics && typeof result.analytics === "object" ? result.analytics : result;
  const eventId = String(analytics.eventId || analytics.event_id || result.eventId || result.event_id || "").trim().slice(0, 160);
  if (result.confirmed === true && eventId) {
    const dedupeKey = `aqg_generate_lead_sent:${eventId}`;
    let alreadySent = false;
    try { alreadySent = sessionStorage.getItem(dedupeKey) === "1"; } catch { alreadySent = false; }
    if (!alreadySent) {
      try { sessionStorage.setItem(dedupeKey, "1"); } catch { /* The in-memory envelope is still removed below. */ }
      const event = {
        event_id: eventId,
        estimated_project_value: Math.max(0, Number(analytics.customerDisplayEstimate ?? result.customerDisplayEstimate ?? 0) || 0),
        estimated_project_currency: String(analytics.currency || result.currency || "USD").slice(0, 8),
        estimate_status: String(analytics.estimateStatus || analytics.estimate_status || result.estimateStatus || "not_requested").slice(0, 40),
      };
      const services = analytics.serviceNeeded || analytics.service_needed;
      if (Array.isArray(services)) event.service_needed = services.map((value) => String(value).slice(0, 80)).slice(0, 6);

      if (window.AQGAnalytics?.track) {
        window.AQGAnalytics.track("generate_lead", event);
      } else if (window.AQGTracking?.pushEvent) {
        window.AQGTracking.pushEvent("generate_lead", event);
      } else {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "generate_lead", ...event });
      }
    }
  }

  if (result.estimateStatus === "calculated" && Number(result.customerDisplayEstimate) > 0) {
    container.hidden = false;
    container.innerHTML = `<h2>Your Preliminary Estimate</h2><p>Based on the information provided, your preliminary project estimate is approximately:</p><strong>$${Math.round(Number(result.customerDisplayEstimate)).toLocaleString("en-US")}</strong><p>This is an approximate starting estimate, not a final quote. Final pricing requires an on-site inspection, accurate measurements, and confirmation of project conditions.</p>`;
    return;
  }
  if (result.estimateStatus === "manual_review") {
    container.hidden = false;
    container.innerHTML = "<p>We received your request. Our team will review the project details and contact you with a more accurate estimate.</p>";
  }
})();

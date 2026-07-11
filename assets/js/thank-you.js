(function () {
  const container = document.querySelector("[data-thank-you-estimate]");
  if (!container) return;
  let result = null;
  try { result = JSON.parse(sessionStorage.getItem("aqg_submission_result") || "null"); } catch { result = null; }
  sessionStorage.removeItem("aqg_submission_result");
  if (!result) return;
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

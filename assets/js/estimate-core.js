(function (root) {
  const SERVICES = Object.freeze({ GUTTERS: "Seamless Gutter Installation", GUARDS: "Gutter Guards", SOFFIT: "Soffit & Fascia", DOWNSPOUTS: "Downspout Installation", ACCESSORIES: "Gutter Miters & Connectors" });
  const PRICES = Object.freeze({ gutters: { "5": 15, "6": 18 }, guards: { basic: 15, micro_mesh: 20 }, fascia: 20, soffit: 25, accessories: { "5": { downspout: 15, elbow: 15, connector: 15, miter: 15 }, "6": { downspout: 18, elbow: 18, connector: 18, miter: 18 } } });
  const LIMITS = Object.freeze({ squareFeet: [200, 30000], stories: [1, 3], downspouts: [0, 100], miters: [0, 200] });
  const MAX_PHOTOS = 10, MAX_PHOTO_BYTES = 10 * 1024 * 1024, PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const clean = (value) => typeof value === "string" ? value.trim() : "";
  const num = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
  const money = (value) => `$${Math.round(value).toLocaleString("en-US")}`;
  const sizeKey = (value) => String(value).startsWith("6") ? "6" : String(value).startsWith("5") ? "5" : "";
  const selected = (raw, key, fallback) => raw[key] === true || raw[key] === "true" || fallback;
  function normalize(raw = {}) {
    const serviceNeeded = Array.isArray(raw.service_needed) ? raw.service_needed : [];
    return { calculatorRequested: raw.calculator_requested === true || raw.calculator_requested === "true", services: serviceNeeded, size: sizeKey(raw.gutter_size || raw.gutter_type), stories: num(raw.home_stories || raw.stories), squareFeet: num(raw.square_feet), guardType: raw.guard_type === "micro_mesh" || raw.gutter_guards === "Micro-Mesh Gutter Guards" ? "micro_mesh" : raw.guard_type === "basic" || raw.gutter_guards === "Basic Gutter Guards" ? "basic" : "", miterCount: num(raw.miter_count || raw.gutter_miter_count), downspoutCount: num(raw.downspout_count), included: { gutters: selected(raw, "include_gutters", serviceNeeded.includes(SERVICES.GUTTERS) || serviceNeeded.includes("Gutter Replacement")), guards: selected(raw, "include_guards", serviceNeeded.includes(SERVICES.GUARDS)), fascia: selected(raw, "include_fascia", false), soffit: selected(raw, "include_soffit", false), downspouts: selected(raw, "include_downspouts", serviceNeeded.includes(SERVICES.DOWNSPOUTS)), connectors: selected(raw, "include_connectors", serviceNeeded.includes(SERVICES.ACCESSORIES)) } };
  }
  function add(items, code, label, quantity, unit, rate, source, quantityLabel) { if (quantity) items.push({ code, label, quantity, unit, rate, subtotal: quantity * rate, quantitySource: source, quantityLabel }); }
  function calculate(raw = {}) {
    const input = normalize(raw);
    if (!input.calculatorRequested) return { input, errors: [], lineItems: [], baseTotal: 0, low: 0, high: 0, range: "", estimateStatus: "not_requested", requiresManualReview: false, customerDisplayEstimate: 0, estimatedGutterLf: 0, estimateDetails: "" };
    const errors = [];
    if (!input.size) errors.push("Please select a 5-inch or 6-inch gutter system.");
    if (input.stories < 1 || input.stories > 3) errors.push("Select Home Stories to calculate an estimate.");
    if (input.squareFeet < LIMITS.squareFeet[0] || input.squareFeet > LIMITS.squareFeet[1]) errors.push("Enter an approximate home size between 200 and 30,000 square feet.");
    if (!Object.values(input.included).some(Boolean)) errors.push("Please select at least one service to include in your estimate.");
    if (input.included.guards && !input.guardType) errors.push("Please choose Basic or Micro-Mesh gutter guards.");
    if ((input.included.downspouts || input.included.connectors) && !input.downspoutCount) errors.push("Enter the number of downspouts.");
    if (input.downspoutCount > LIMITS.downspouts[1]) errors.push("Number of downspouts is outside the allowed range.");
    if (input.miterCount > LIMITS.miters[1]) errors.push("Number of gutter corners is outside the allowed range.");
    if (errors.length) return { input, errors, lineItems: [], baseTotal: 0, low: 0, high: 0, range: "", estimateStatus: "invalid", requiresManualReview: false, customerDisplayEstimate: 0, estimatedGutterLf: 0, estimateDetails: "" };
    const perimeter = Math.round(4 * Math.sqrt(input.squareFeet / input.stories)); const size = input.size; const rate = PRICES.accessories[size]; const items = [];
    if (input.included.gutters) add(items, `gutters_${size}`, `${size}\" Gutters`, perimeter, "LF", PRICES.gutters[size], "estimated_from_home_size");
    if (input.included.guards) add(items, `guards_${input.guardType}`, input.guardType === "basic" ? "Basic Gutter Guards" : "Micro-Mesh Gutter Guards", perimeter, "LF", PRICES.guards[input.guardType], "based_on_gutter_system_length");
    if (input.included.fascia) add(items, "fascia", "Fascia", perimeter, "LF", PRICES.fascia, "estimated_from_home_size");
    if (input.included.soffit) add(items, "soffit", "Soffit Panel", perimeter, "LF", PRICES.soffit, "estimated_from_home_size");
    if (input.included.downspouts) { const length = input.stories * 10; add(items, `downspouts_${size}`, `${size}\" Downspouts`, input.downspoutCount * length, "LF", rate.downspout, "estimated_from_number_of_stories", `${input.downspoutCount} downspouts × ${length} LF`); add(items, `elbows_${size}`, `${size}\" Elbows`, input.downspoutCount * 3, "each", rate.elbow, "calculated_from_downspout_count"); }
    if (input.included.connectors) add(items, `connectors_${size}`, `${size}\" Connectors`, input.downspoutCount, "each", rate.connector, "calculated_from_downspout_count");
    if (input.miterCount) add(items, `miters_${size}`, `${size}\" Gutter Miters`, input.miterCount, "each", rate.miter, "provided_by_customer");
    const baseTotal = items.reduce((sum, item) => sum + item.subtotal, 0); const step = baseTotal < 250 ? 5 : baseTotal < 1000 ? 25 : 100; const low = Math.floor(baseTotal * .85 / step) * step; const high = Math.ceil(baseTotal * 1.15 / step) * step;
    return { input, errors: [], lineItems: items, baseTotal, low, high, range: `${money(low)}–${money(high)}`, estimateStatus: "calculated", requiresManualReview: false, customerDisplayEstimate: Math.round(baseTotal * 1.03), estimatedGutterLf: perimeter, estimateDetails: items.map((item) => `${item.label}: ${item.quantityLabel || `${item.quantity} ${item.unit}`} × $${item.rate} = ${money(item.subtotal)}`).join("\n") };
  }
  function newYorkToday(now = new Date()) { const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now); const v = (type) => Number(p.find((x) => x.type === type)?.value || 0); return new Date(v("year"), v("month") - 1, v("day")); }
  function validDate(value, now = new Date()) { if (!value) return true; const m = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return false; const date = new Date(+m[3], +m[1] - 1, +m[2]); return date > newYorkToday(now) && date.getDay() !== 0; }
  function serviceAreaStatus(zip, supported = []) { if (!/^\d{5}$/.test(zip)) return ""; if (supported.includes(zip)) return "supported"; const value = +zip; return (value >= 7000 && value <= 8999) || (value >= 15000 && value <= 19699) ? "needs_review" : "outside_primary_area"; }
  function validatePhotoMeta(files = []) { if (files.length > MAX_PHOTOS) return "You can upload up to 10 photos."; return files.some((file) => !PHOTO_TYPES.has(file.type) || file.size > MAX_PHOTO_BYTES) ? "Photos must be JPG, PNG, or WEBP files up to 10MB each." : ""; }
  root.AQGEstimateCore = { SERVICES, PRICES, LIMITS, MAX_PHOTOS, MAX_PHOTO_BYTES, PHOTO_TYPES, normalize, calculate, sizeKey, validDate, newYorkToday, serviceAreaStatus, validatePhotoMeta, money };
})(globalThis);

(function (root) {
  const SERVICES = Object.freeze({ GUTTERS: ["Seamless Gutter Installation", "Gutter Replacement"], GUARDS: "Gutter Guards", SOFFIT: "Soffit & Fascia", DOWNSPOUTS: "Downspout Installation", ACCESSORIES: "Gutter Miters & Connectors" });
  const PRICES = Object.freeze({ gutters: Object.freeze({ "5": 15, "6": 18 }), guards: Object.freeze({ basic: 15, micro_mesh: 20 }), fascia: 20, soffit: 25, accessories: Object.freeze({ "5": Object.freeze({ downspout: 15, elbow: 15, miter: 15, connector: 15 }), "6": Object.freeze({ downspout: 18, elbow: 18, miter: 18, connector: 18 }) }) });
  const LIMITS = Object.freeze({ squareFeet: [200, 30000], stories: [1, 3], linearFeet: [0, 5000], downspouts: [0, 100], elbows: [0, 500], connectors: [0, 200], miters: [0, 200] });
  const MAX_PHOTOS = 6;
  const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
  const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const validServices = new Set([...SERVICES.GUTTERS, SERVICES.GUARDS, SERVICES.SOFFIT, SERVICES.DOWNSPOUTS, SERVICES.ACCESSORIES]);
  const clean = (value) => typeof value === "string" ? value.trim() : "";
  const hasValue = (value) => String(value ?? "").trim() !== "";
  const numeric = (value) => hasValue(value) && Number.isFinite(Number(value));
  const whole = (value, fallback = 0) => numeric(value) ? Math.max(0, Math.round(Number(value))) : fallback;
  const inRange = (value, range) => value >= range[0] && value <= range[1];
  const money = (value) => `$${Math.round(value).toLocaleString("en-US")}`;
  const selected = (input, service) => input.services.includes(service);
  const usesGutters = (input) => SERVICES.GUTTERS.some((service) => selected(input, service));
  const sizeKey = (value) => /^6(?:\"|\s|$)/.test(clean(value)) || clean(value) === "6" ? "6" : /^5(?:\"|\s|$)/.test(clean(value)) || clean(value) === "5" ? "5" : "";
  const gutterLabel = (size) => `${size}\" Aluminum K-Style`;
  const accessoryLabel = (size, noun) => `${size}\" ${noun}`;

  function normalize(raw = {}) {
    const requested = raw.service_needed || raw.services || [];
    const services = (Array.isArray(requested) ? requested : [requested]).map(clean).filter((item) => validServices.has(item));
    const legacyGutterMode = clean(raw.whole_house_gutters) === "Yes" ? "whole_house" : clean(raw.whole_house_gutters) === "No" ? "selected_sections" : clean(raw.whole_house_gutters) === "not_sure" ? "not_sure" : "";
    const guardType = clean(raw.gutter_guards) === "Basic Gutter Guards" || clean(raw.guard_type) === "basic" ? "basic" : clean(raw.gutter_guards) === "Micro-Mesh Gutter Guards" || clean(raw.guard_type) === "micro_mesh" ? "micro_mesh" : "";
    const requestedCalculator = raw.calculator_requested === true || clean(raw.calculator_requested) === "true";
    return {
      services, calculatorRequested: requestedCalculator, size: sizeKey(raw.gutter_size || raw.gutter_type),
      gutterMode: clean(raw.gutter_mode) || legacyGutterMode, gutterLf: whole(raw.gutter_lf), squareFeet: whole(raw.square_feet), stories: whole(raw.stories || raw.home_stories),
      guardType, guardMode: clean(raw.guard_mode || raw.guard_lf_mode), guardLf: whole(raw.guard_lf),
      fasciaMode: clean(raw.fascia_mode).replace(/^No$/i, "not_needed").replace(/^Yes$/i, "whole_house"), fasciaLf: whole(raw.fascia_lf),
      soffitMode: clean(raw.soffit_mode).replace(/^No$/i, "not_needed").replace(/^Yes$/i, "whole_house"), soffitLf: whole(raw.soffit_lf),
      downspoutMode: clean(raw.downspout_mode), downspoutCount: whole(raw.downspout_count), downspoutLengthPerUnit: whole(raw.downspout_length_per_unit),
      elbowCount: whole(raw.elbow_count), connectorCount: whole(raw.downspout_connector_count || raw.connector_count), miterCount: whole(raw.gutter_miter_count || raw.miter_count),
      elbowOverride: clean(raw.elbow_manual_override) === "true", connectorOverride: clean(raw.connector_manual_override) === "true", accessoryMode: clean(raw.accessory_mode),
      preferredDate: clean(raw.preferred_date), zip: clean(raw.zip_code || raw.zip)
    };
  }

  function addItem(items, code, label, quantity, unit, rate, quantitySource, quantityLabel) {
    if (!quantity || !rate) return;
    items.push({ code, label, quantity, unit, rate, subtotal: quantity * rate, quantitySource, quantityLabel });
  }
  function estimateHomeLf(input) {
    if (!inRange(input.squareFeet, LIMITS.squareFeet) || !inRange(input.stories, LIMITS.stories)) return null;
    return Math.round(4 * Math.sqrt(input.squareFeet / input.stories));
  }
  function requireNumber(raw, key, value, range, message, errors) {
    if (!hasValue(raw[key]) || !numeric(raw[key]) || !inRange(value, range)) errors.push(message);
  }
  function validateDate(value, now = new Date()) {
    if (!value) return true;
    const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return false;
    const date = new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
    const today = newYorkToday(now);
    return date.getMonth() === Number(match[1]) - 1 && date.getDate() === Number(match[2]) && date > today && date.getDay() !== 0;
  }

  function calculate(raw = {}, options = {}) {
    const input = normalize(raw);
    if (!input.calculatorRequested) return { input, errors: [], lineItems: [], baseTotal: 0, low: 0, high: 0, range: "", requiresManualReview: false, estimateStatus: "not_requested", customerDisplayEstimate: 0, estimateDetails: "" };
    const errors = [];
    const items = [];
    let manualReview = false;
    const needsSize = usesGutters(input) || selected(input, SERVICES.DOWNSPOUTS) || selected(input, SERVICES.ACCESSORIES);
    if (needsSize && !input.size) errors.push("Please select a 5-inch or 6-inch gutter system to calculate accessory pricing.");
    if (input.preferredDate && !validateDate(input.preferredDate, options.now)) errors.push("Please choose a future Monday through Saturday appointment date.");
    [["gutter_lf", input.gutterLf, LIMITS.linearFeet], ["guard_lf", input.guardLf, LIMITS.linearFeet], ["fascia_lf", input.fasciaLf, LIMITS.linearFeet], ["soffit_lf", input.soffitLf, LIMITS.linearFeet], ["downspout_length_per_unit", input.downspoutLengthPerUnit, LIMITS.linearFeet], ["downspout_count", input.downspoutCount, LIMITS.downspouts], ["elbow_count", input.elbowCount, LIMITS.elbows], ["downspout_connector_count", input.connectorCount, LIMITS.connectors], ["gutter_miter_count", input.miterCount, LIMITS.miters]].forEach(([key, value, range]) => { if (hasValue(raw[key]) && (!numeric(raw[key]) || !inRange(value, range))) errors.push(`${key.replaceAll("_", " ")} is outside the allowed range.`); });

    let gutterLength = null;
    let gutterSource = "";
    if (usesGutters(input)) {
      if (input.gutterMode === "not_sure") manualReview = true;
      else if (input.gutterLf > 0) { gutterLength = input.gutterLf; gutterSource = "Provided by customer"; }
      else if (input.gutterMode === "whole_house") { gutterLength = estimateHomeLf(input); gutterSource = "Estimated from home size"; if (!gutterLength) errors.push("Whole-house gutters require square feet, home stories, or manual linear feet."); }
      else if (input.gutterMode === "selected_sections") errors.push("Selected gutter sections require approximate linear feet or I'm not sure.");
      else errors.push("Choose whole house, selected sections, or I'm not sure for gutters.");
      if (input.size && gutterLength) addItem(items, `gutters_${input.size}`, gutterLabel(input.size), gutterLength, "LF", PRICES.gutters[input.size], gutterSource);
    }

    if (selected(input, SERVICES.GUARDS)) {
      if (!input.guardType) errors.push("Choose Basic or Micro-Mesh gutter guards.");
      if (input.guardMode === "not_sure") manualReview = true;
      else if (input.guardMode === "same_gutter") { if (!gutterLength) errors.push("Guard coverage based on gutter length requires a calculated gutter system length."); else addItem(items, `guards_${input.guardType}`, input.guardType === "basic" ? "Basic Gutter Guards" : "Micro-Mesh Gutter Guards", gutterLength, "LF", PRICES.guards[input.guardType], "Based on gutter system length"); }
      else if (input.guardMode === "whole_house" || input.guardMode === "selected_sections") { if (!input.guardLf) errors.push("Gutter guards require approximate linear feet or I'm not sure."); else addItem(items, `guards_${input.guardType}`, input.guardType === "basic" ? "Basic Gutter Guards" : "Micro-Mesh Gutter Guards", input.guardLf, "LF", PRICES.guards[input.guardType], "Provided by customer"); }
      else errors.push("Choose coverage for gutter guards.");
    }

    const trimItem = (kind, mode, lf, rate, code, label) => {
      if (mode === "not_needed" || !mode) return;
      if (mode === "not_sure") { manualReview = true; return; }
      if (lf > 0) { addItem(items, code, label, lf, "LF", rate, "Provided by customer"); return; }
      if (mode === "whole_house") { const estimate = estimateHomeLf(input); if (!estimate) errors.push(`${label} whole-house coverage requires square feet, home stories, manual LF, or I'm not sure.`); else addItem(items, code, label, estimate, "LF", rate, "Estimated from home size"); return; }
      errors.push(`${label} selected sections require approximate linear feet or I'm not sure.`);
    };
    if (selected(input, SERVICES.SOFFIT)) {
      if ((input.fasciaMode === "not_needed" || !input.fasciaMode) && (input.soffitMode === "not_needed" || !input.soffitMode)) errors.push("Choose Fascia, Soffit, or both for this service.");
      trimItem("fascia", input.fasciaMode, input.fasciaLf, PRICES.fascia, "fascia", "Fascia");
      trimItem("soffit", input.soffitMode, input.soffitLf, PRICES.soffit, "soffit", "Soffit Panel");
    }

    if (selected(input, SERVICES.DOWNSPOUTS)) {
      if (input.downspoutMode === "not_sure") manualReview = true;
      else {
        if (!input.downspoutCount) errors.push("Downspout installation requires at least one downspout.");
        const length = input.downspoutLengthPerUnit || (input.stories ? input.stories * 10 : 0);
        if (!length) errors.push("Downspout installation requires home stories, a manual length, or I'm not sure.");
        if (input.size && input.downspoutCount && length) {
          const rate = PRICES.accessories[input.size];
          const elbows = input.elbowOverride ? input.elbowCount : input.downspoutCount * 3;
          const connectors = input.connectorOverride ? input.connectorCount : input.downspoutCount;
          addItem(items, `downspouts_${input.size}`, accessoryLabel(input.size, "Downspouts"), input.downspoutCount * length, "LF", rate.downspout, input.downspoutLengthPerUnit ? "Provided by customer" : "Estimated from number of stories", `${input.downspoutCount} downspouts × ${length} LF`);
          addItem(items, `elbows_${input.size}`, accessoryLabel(input.size, "Elbows"), elbows, "each", rate.elbow, input.elbowOverride ? "Provided by customer" : "Calculated from downspout count");
          addItem(items, `connectors_${input.size}`, accessoryLabel(input.size, "Connectors"), connectors, "each", rate.connector, input.connectorOverride ? "Provided by customer" : "Calculated from downspout count");
        }
      }
    }
    if (selected(input, SERVICES.ACCESSORIES)) {
      if (input.accessoryMode === "not_sure") manualReview = true;
      else if (!input.miterCount && !input.connectorCount) errors.push("Enter at least one gutter miter or downspout connector, or choose I'm not sure.");
      else if (input.size) { const rate = PRICES.accessories[input.size]; addItem(items, `miters_${input.size}`, accessoryLabel(input.size, "Miters"), input.miterCount, "each", rate.miter, "Provided by customer"); addItem(items, `connectors_${input.size}`, accessoryLabel(input.size, "Connectors"), input.connectorCount, "each", rate.connector, "Provided by customer"); }
    }
    const baseTotal = items.reduce((total, item) => total + item.subtotal, 0);
    const status = manualReview ? "manual_review" : errors.length ? "invalid" : baseTotal ? "calculated" : "invalid";
    const step = baseTotal < 250 ? 5 : baseTotal < 1000 ? 25 : 100;
    const low = status === "calculated" ? Math.max(step, Math.floor((baseTotal * 0.85) / step) * step) : 0;
    const high = status === "calculated" ? Math.max(step, Math.ceil((baseTotal * 1.15) / step) * step) : 0;
    const estimateDetails = items.map((item) => `${item.label}: ${item.quantityLabel || `${item.quantity} ${item.unit}`} × $${item.rate}${item.unit === "LF" ? "/LF" : ""} = ${money(item.subtotal)} (${item.quantitySource})`).join("\n");
    return { input, errors: [...new Set(errors)], lineItems: items, baseTotal, low, high, range: status === "calculated" ? `${money(low)}–${money(high)}` : "", requiresManualReview: manualReview, estimateStatus: status, customerDisplayEstimate: status === "calculated" ? Math.round(baseTotal * 1.03) : 0, estimateDetails };
  }

  function newYorkToday(now = new Date()) { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now); const part = (type) => Number(parts.find((value) => value.type === type)?.value || 0); return new Date(part("year"), part("month") - 1, part("day")); }
  function serviceAreaStatus(zip, supportedZips = []) { if (!/^\d{5}$/.test(zip)) return ""; if (supportedZips.includes(zip)) return "supported"; const value = Number(zip); return (value >= 7000 && value <= 8999) || (value >= 15000 && value <= 19699) ? "needs_review" : "outside_primary_area"; }
  function validatePhotoMeta(files = []) { if (files.length > MAX_PHOTOS) return "You can upload up to 6 photos."; for (const file of files) if (!PHOTO_TYPES.has(file.type) || file.size > MAX_PHOTO_BYTES) return "Photos must be JPG, PNG, or WEBP files up to 10MB each."; return ""; }
  root.AQGEstimateCore = { SERVICES, PRICES, LIMITS, MAX_PHOTOS, MAX_PHOTO_BYTES, PHOTO_TYPES, normalize, calculate, sizeKey, serviceAreaStatus, validDate: validateDate, validatePhotoMeta, newYorkToday, money };
})(globalThis);

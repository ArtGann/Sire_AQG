import test from "node:test";
import assert from "node:assert/strict";
import "../assets/js/estimate-core.js";

const core = globalThis.AQGEstimateCore;
const base = { calculator_requested: true };

test("downspout-only uses home stories and correct 6-inch accessory codes", () => {
  const result = core.calculate({ ...base, service_needed: ["Downspout Installation"], gutter_type: '6" Aluminum K-Style', stories: 2, downspout_count: 4 });
  assert.equal(result.estimateStatus, "calculated");
  assert.deepEqual(result.lineItems.map((item) => item.code), ["downspouts_6", "elbows_6", "connectors_6"]);
  assert.equal(result.lineItems[0].quantity, 80);
  assert.equal(result.lineItems[0].rate, 18);
  assert.match(result.lineItems[0].label, /^6" Downspouts$/);
});

test("gutter services validate all service-dependent calculator inputs", () => {
  const guardsMissingType = core.calculate({ ...base, service_needed: ["Gutter Guards"], guard_mode: "selected_sections", guard_lf: 20 });
  assert.match(guardsMissingType.errors.join(" "), /Basic or Micro-Mesh/);
  const guardsMissingLf = core.calculate({ ...base, service_needed: ["Gutter Guards"], gutter_guards: "Basic Gutter Guards", guard_mode: "selected_sections" });
  assert.match(guardsMissingLf.errors.join(" "), /linear feet/);
  const soffitEmpty = core.calculate({ ...base, service_needed: ["Soffit & Fascia"], fascia_mode: "not_needed", soffit_mode: "not_needed" });
  assert.match(soffitEmpty.errors.join(" "), /Choose Fascia/);
  const downspoutZero = core.calculate({ ...base, service_needed: ["Downspout Installation"], gutter_type: '5" Aluminum K-Style', stories: 1, downspout_count: 0 });
  assert.match(downspoutZero.errors.join(" "), /at least one downspout/);
  const wholeHouseMissing = core.calculate({ ...base, service_needed: ["Gutter Replacement"], gutter_type: '5" Aluminum K-Style', gutter_mode: "whole_house" });
  assert.match(wholeHouseMissing.errors.join(" "), /square feet/);
});

test("fascia and soffit ignore stale LF when not needed", () => {
  const result = core.calculate({ ...base, service_needed: ["Soffit & Fascia"], fascia_mode: "not_needed", fascia_lf: 100, soffit_mode: "selected_sections", soffit_lf: 40 });
  assert.equal(result.estimateStatus, "calculated");
  assert.equal(result.baseTotal, 1000);
  assert.deepEqual(result.lineItems.map((item) => item.code), ["soffit"]);
});

test("I'm not sure produces manual review without a customer estimate", () => {
  const result = core.calculate({ ...base, service_needed: ["Gutter Guards"], gutter_guards: "Basic Gutter Guards", guard_mode: "not_sure" });
  assert.equal(result.estimateStatus, "manual_review");
  assert.equal(result.requiresManualReview, true);
  assert.equal(result.customerDisplayEstimate, 0);
  assert.equal(result.range, "");
});

test("calculator not requested produces no calculation", () => {
  const result = core.calculate({ service_needed: ["Gutter Replacement"], gutter_type: '5" Aluminum K-Style', gutter_lf: 50 });
  assert.equal(result.estimateStatus, "not_requested");
  assert.equal(result.lineItems.length, 0);
});

test("calculated display estimate adds three percent without changing base", () => {
  const result = core.calculate({ ...base, service_needed: ["Gutter Replacement"], gutter_type: '5" Aluminum K-Style', gutter_mode: "selected_sections", gutter_lf: 50 });
  assert.equal(result.estimateStatus, "calculated");
  assert.equal(result.baseTotal, 750);
  assert.equal(result.customerDisplayEstimate, 773);
});

test("date validation blocks yesterday, today, and Sundays in New York", () => {
  const now = new Date("2026-07-11T16:00:00Z");
  assert.equal(core.validDate("07/10/2026", now), false);
  assert.equal(core.validDate("07/11/2026", now), false);
  assert.equal(core.validDate("07/12/2026", now), false);
  assert.equal(core.validDate("07/13/2026", now), true);
});

test("photo metadata and service area validation", () => {
  assert.match(core.validatePhotoMeta(Array.from({ length: 7 }, () => ({ type: "image/jpeg", size: 1 }))), /up to 6/);
  assert.match(core.validatePhotoMeta([{ type: "image/jpeg", size: core.MAX_PHOTO_BYTES + 1 }]), /10MB/);
  assert.match(core.validatePhotoMeta([{ type: "image/gif", size: 1 }]), /JPG/);
  assert.equal(core.serviceAreaStatus("19019", ["19019"]), "supported");
  assert.equal(core.serviceAreaStatus("90210"), "outside_primary_area");
});

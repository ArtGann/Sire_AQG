import test from "node:test";
import assert from "node:assert/strict";
import "../assets/js/estimate-core.js";
const core = globalThis.AQGEstimateCore;
const base = { calculator_requested: true, home_stories: 1, square_feet: 2000, gutter_size: "5", include_gutters: true };
test("basic lead has no estimate when calculator is closed", () => assert.equal(core.calculate({ service_needed: ["Gutter Guards"] }).estimateStatus, "not_requested"));
test("simplified calculator requires size, services, stories and home size", () => assert.match(core.calculate({ calculator_requested: true }).errors.join(" "), /gutter system/));
test("5 and 6 inch gutters use home perimeter and correct rates", () => { assert.equal(core.calculate(base).lineItems[0].subtotal, 2685); const six = core.calculate({ ...base, gutter_size: "6" }); assert.equal(six.lineItems[0].code, "gutters_6"); assert.equal(six.lineItems[0].rate, 18); });
test("guards fascia and soffit use estimated home perimeter", () => { const result = core.calculate({ ...base, include_gutters: false, include_guards: true, guard_type: "micro_mesh", include_fascia: true, include_soffit: true }); assert.equal(result.baseTotal, 179 * 65); });
test("two-story downspouts calculate length elbows and optional connectors", () => { const result = core.calculate({ ...base, home_stories: 2, include_gutters: false, include_downspouts: true, include_connectors: true, downspout_count: 4, miter_count: 4 }); assert.deepEqual(result.lineItems.map((x) => x.code), ["downspouts_5", "elbows_5", "connectors_5", "miters_5"]); assert.equal(result.lineItems[0].quantity, 80); assert.equal(result.lineItems[1].quantity, 12); });
test("connectors require downspouts and guards require type", () => { assert.match(core.calculate({ ...base, include_gutters: false, include_connectors: true }).errors.join(" "), /downspouts/); assert.match(core.calculate({ ...base, include_gutters: false, include_guards: true }).errors.join(" "), /Basic or Micro/); });
test("calculator rejects counts above the server-supported limits", () => { assert.match(core.calculate({ ...base, miter_count: 201 }).errors.join(" "), /gutter corners/); assert.match(core.calculate({ ...base, include_gutters: false, include_downspouts: true, downspout_count: 101 }).errors.join(" "), /downspouts/); });
test("customer amount applies three percent only after base calculation", () => { const result = core.calculate(base); assert.equal(result.customerDisplayEstimate, Math.round(result.baseTotal * 1.03)); });
test("dates, photos, and area checks remain valid", () => {
  assert.equal(core.validDate("07/12/2026", new Date("2026-07-11T16:00:00Z")), false);
  assert.equal(core.validatePhotoMeta(Array.from({ length: 10 }, () => ({ type: "image/jpeg", size: 10 * 1024 * 1024 }))), "");
  assert.match(core.validatePhotoMeta(Array.from({ length: 11 }, () => ({ type: "image/jpeg", size: 1 }))), /up to 10/);
  assert.match(core.validatePhotoMeta([{ type: "image/png", size: 10 * 1024 * 1024 + 1 }]), /up to 10MB/);
  assert.match(core.validatePhotoMeta([{ type: "image/gif", size: 1 }]), /JPG, PNG, or WEBP/);
});

test("confirmed and configured ZIP codes are supported areas", () => {
  assert.deepEqual(core.CONFIRMED_SUPPORTED_ZIPS, ["19057"]);
  assert.equal(core.serviceAreaStatus("19057"), "supported_area");
  assert.equal(core.serviceAreaStatus("19103", ["19103"]), "supported_area");
  assert.equal(core.serviceAreaStatus("08001", [" 08001 "]), "supported_area");
  assert.equal(core.serviceAreaStatus("19058", ["1905", "ABCDE"]), "needs_review");
});

test("service-area review envelopes and outside-area boundaries remain intact", () => {
  for (const zip of ["07000", "08999", "15000", "19699"]) {
    assert.equal(core.serviceAreaStatus(zip), "needs_review", zip);
  }
  for (const zip of ["06999", "09000", "14999", "19700", "90210"]) {
    assert.equal(core.serviceAreaStatus(zip), "outside_primary_area", zip);
  }
  for (const zip of ["", "1905", "ABCDE", "19057-1234"]) {
    assert.equal(core.serviceAreaStatus(zip), "", zip);
  }
});

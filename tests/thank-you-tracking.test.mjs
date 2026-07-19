import test from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

async function runThankYou({ storage, result, events }) {
  if (result !== undefined) storage.setItem("aqg_submission_result", JSON.stringify(result));
  const container = { hidden: true, innerHTML: "" };
  const previous = { window: globalThis.window, document: globalThis.document, sessionStorage: globalThis.sessionStorage };
  globalThis.window = { AQGAnalytics: { track: (event, properties) => events.push({ event, properties }) } };
  globalThis.document = { querySelector: () => container };
  globalThis.sessionStorage = storage;
  try {
    await import(new URL(`../assets/js/thank-you.js?test=${Date.now()}-${Math.random()}`, import.meta.url));
  } finally {
    if (previous.window === undefined) delete globalThis.window; else globalThis.window = previous.window;
    if (previous.document === undefined) delete globalThis.document; else globalThis.document = previous.document;
    if (previous.sessionStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = previous.sessionStorage;
  }
  return container;
}

test("thank-you emits generate_lead once only for a confirmed non-PII envelope", async () => {
  const storage = new MemoryStorage();
  const events = [];
  const envelope = {
    confirmed: true,
    eventId: "lead-event-1",
    currency: "USD",
    estimateStatus: "calculated",
    customerDisplayEstimate: 2500,
    serviceNeeded: ["Gutter Replacement"],
  };

  const rendered = await runThankYou({ storage, result: envelope, events });
  assert.equal(events.length, 1);
  assert.equal(events[0].event, "generate_lead");
  assert.equal(events[0].properties.event_id, "lead-event-1");
  assert.equal(events[0].properties.estimated_project_value, 2500);
  assert.equal("value" in events[0].properties, false);
  assert.match(rendered.innerHTML, /\$2,500/);
  assert.equal(storage.getItem("aqg_submission_result"), null);

  await runThankYou({ storage, result: envelope, events });
  assert.equal(events.length, 1);

  await runThankYou({ storage, result: { ...envelope, confirmed: false, eventId: "lead-event-2" }, events });
  assert.equal(events.length, 1);
});

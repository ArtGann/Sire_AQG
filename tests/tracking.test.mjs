import test from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function browser(url, referrer = "", config = {}) {
  const listeners = new Map();
  const scripts = [];
  const document = {
    title: "Gutter Installation",
    referrer,
    addEventListener(type, listener) { listeners.set(type, listener); },
    querySelector() { return null; },
    createElement() { return {}; },
    head: { append(node) { scripts.push(node); } },
  };
  const window = {
    document,
    location: new URL(url),
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    crypto: globalThis.crypto,
    dataLayer: [],
    fetch: async () => new Response(JSON.stringify(config), { status: 200, headers: { "Content-Type": "application/json" } }),
  };
  return { window, document, listeners, scripts };
}

async function loadTracking(fake) {
  const previousWindow = globalThis.window;
  globalThis.window = fake.window;
  try {
    await import(new URL(`../assets/js/tracking.js?test=${Date.now()}-${Math.random()}`, import.meta.url));
    await fake.window.AQGTracking.ready;
    return fake.window.AQGTracking;
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test("tracking preserves first touch and updates only the last non-direct touch", async () => {
  const fake = browser(
    "https://www.allqualitygutters.com/services/gutter-guards/?utm_source=google&utm_medium=cpc&utm_campaign=guards&gclid=abc123&email=private@example.com",
    "https://www.google.com/search?q=gutters"
  );
  const tracking = await loadTracking(fake);
  const first = tracking.getAttribution();
  assert.equal(first.first_utm_source, "google");
  assert.equal(first.first_gclid, "abc123");
  assert.equal(first.first_landing_page_url, "https://www.allqualitygutters.com/services/gutter-guards/");
  assert.equal(first.landing_page_url.includes("private@example.com"), false);

  fake.window.location = new URL("https://www.allqualitygutters.com/about/");
  fake.document.referrer = "https://www.allqualitygutters.com/services/gutter-guards/";
  tracking.refreshAttribution();
  const internal = tracking.getAttribution();
  assert.equal(internal.first_utm_source, "google");
  assert.equal(internal.last_utm_source, "google");
  assert.equal(internal.page_path, "/about/");
  assert.equal(internal.session_id, first.session_id);

  fake.window.location = new URL("https://www.allqualitygutters.com/?utm_source=bing&utm_medium=cpc&msclkid=ms-456");
  fake.document.referrer = "https://www.bing.com/search?q=gutters";
  tracking.refreshAttribution();
  const later = tracking.getAttribution();
  assert.equal(later.first_utm_source, "google");
  assert.equal(later.last_utm_source, "bing");
  assert.equal(later.msclkid, "ms-456");
});

test("tracking loads configured GTM and emits delegated CTA, phone, and email events", async () => {
  const fake = browser("https://www.allqualitygutters.com/", "", { gtmContainerId: "GTM-ABC123" });
  const tracking = await loadTracking(fake);
  assert.equal(fake.scripts.some((script) => String(script.src).includes("GTM-ABC123")), true);
  assert.equal(typeof fake.window.AQGAnalytics.track, "function");

  const click = fake.listeners.get("click");
  const element = (href, text, kind = "content") => ({
    dataset: {},
    textContent: text,
    getAttribute(name) { return name === "href" ? href : ""; },
    hasAttribute(name) { return name === "data-open-estimate-modal" && kind === "estimate"; },
    closest(selector) {
      if (selector === "a, button") return this;
      if (selector === ".mobile-sticky") return kind === "mobile" ? {} : null;
      return null;
    },
  });

  click({ target: element("tel:+18445880075", "Call Now", "mobile") });
  click({ target: element("mailto:info@allqualitygutters.com", "Email Us") });
  click({ target: element("/#estimate", "Free Estimate", "estimate") });
  assert.deepEqual(
    fake.window.dataLayer.filter((entry) => entry.event && !entry.event.startsWith("gtm")).map((entry) => entry.event),
    ["click_to_call", "email_click", "estimate_cta_click"]
  );
  assert.equal(tracking.getAttribution().cta_location, "page_content");
});

test("tracking falls back to direct GA4 when no GTM container is configured", async () => {
  const fake = browser("https://www.allqualitygutters.com/", "", { ga4MeasurementId: "G-ABC12345", googleAdsId: "AW-123456789" });
  await loadTracking(fake);
  assert.equal(fake.scripts.some((script) => String(script.src).includes("gtag/js?id=G-ABC12345")), true);
  assert.equal(typeof fake.window.gtag, "function");
  fake.window.AQGAnalytics.track("generate_lead", { event_id: "lead-test", value: 100, currency: "USD" });
  const eventCommand = fake.window.dataLayer.find((entry) => {
    const values = Array.from(entry || []);
    return values[0] === "event" && values[1] === "generate_lead";
  });
  assert.ok(eventCommand, "direct GA4 mode must dispatch custom events through gtag");
  assert.equal(Array.from(eventCommand)[2].event_id, "lead-test");
});

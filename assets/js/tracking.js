(function (window) {
  "use strict";

  if (!window?.document || window.AQGTracking) return;

  const document = window.document;
  const ATTRIBUTION_KEY = "aqg_attribution_v1";
  const SESSION_KEY = "aqg_tracking_session_v1";
  const CTA_KEY = "aqg_last_estimate_cta_v1";
  const ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
  const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  const CLICK_ID_KEYS = ["gclid", "fbclid", "gbraid", "wbraid", "msclkid"];
  const SEARCH_HOSTS = [
    "google.",
    "bing.com",
    "yahoo.com",
    "duckduckgo.com",
    "search.brave.com",
  ];

  let memoryAttribution = null;
  let memorySession = null;
  let publicConfig = {};
  let deliveryMode = "pending";
  const pendingDirectEvents = [];

  const clean = (value, max = 300) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

  const readJson = (storage, key) => {
    try {
      return JSON.parse(storage?.getItem(key) || "null");
    } catch {
      return null;
    }
  };

  const writeJson = (storage, key, value) => {
    try {
      storage?.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };

  const safeUrl = (value, base = window.location.href) => {
    try {
      const url = new URL(value, base);
      if (!/^https?:$/.test(url.protocol)) return "";
      return `${url.origin}${url.pathname}`.slice(0, 500);
    } catch {
      return "";
    }
  };

  const safePath = () => `${window.location.pathname || "/"}`.slice(0, 300);

  const makeId = () => {
    try {
      return window.crypto?.randomUUID?.() || `aqg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    } catch {
      return `aqg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  };

  const isExternalReferrer = (referrer) => {
    if (!referrer) return false;
    try {
      return new URL(referrer).origin !== window.location.origin;
    } catch {
      return false;
    }
  };

  const referralDefaults = (referrer) => {
    if (!isExternalReferrer(referrer)) return {};
    try {
      const hostname = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
      const organic = SEARCH_HOSTS.some((value) => hostname.includes(value));
      return { utm_source: hostname, utm_medium: organic ? "organic" : "referral" };
    } catch {
      return {};
    }
  };

  const campaignFromLocation = () => {
    const params = new URLSearchParams(window.location.search || "");
    return [...CAMPAIGN_KEYS, ...CLICK_ID_KEYS].reduce((result, key) => {
      result[key] = clean(params.get(key) || "", key.endsWith("clid") ? 256 : 200);
      return result;
    }, {});
  };

  const createTouch = () => {
    const rawReferrer = document.referrer || "";
    const referrer = safeUrl(rawReferrer);
    const campaign = campaignFromLocation();
    const referral = referralDefaults(document.referrer || "");
    if (!campaign.utm_source && referral.utm_source) campaign.utm_source = referral.utm_source;
    if (!campaign.utm_medium && referral.utm_medium) campaign.utm_medium = referral.utm_medium;

    return {
      landing_page_url: safeUrl(window.location.href),
      referrer,
      external_referrer: isExternalReferrer(rawReferrer),
      timestamp: new Date().toISOString(),
      ...campaign,
    };
  };

  const isNonDirectTouch = (touch) =>
    Boolean(
      touch.external_referrer === true ||
      [...CAMPAIGN_KEYS, ...CLICK_ID_KEYS].some((key) => clean(touch[key]))
    );

  const loadAttribution = () => {
    const stored = readJson(window.localStorage, ATTRIBUTION_KEY) || memoryAttribution;
    if (!stored || Number(stored.expires_at || 0) <= Date.now()) return null;
    return stored;
  };

  const saveAttribution = (value) => {
    memoryAttribution = value;
    writeJson(window.localStorage, ATTRIBUTION_KEY, value);
  };

  const ensureSession = () => {
    const stored = readJson(window.sessionStorage, SESSION_KEY) || memorySession;
    if (stored?.session_id) {
      memorySession = stored;
      return stored;
    }

    const session = {
      session_id: makeId(),
      started_at: new Date().toISOString(),
      landing_page_url: safeUrl(window.location.href),
      landing_referrer: safeUrl(document.referrer || ""),
    };
    memorySession = session;
    writeJson(window.sessionStorage, SESSION_KEY, session);
    return session;
  };

  const refreshAttribution = () => {
    const touch = createTouch();
    const existing = loadAttribution();
    const attribution = existing || {
      version: 1,
      first_touch: touch,
      last_non_direct: isNonDirectTouch(touch) ? touch : null,
      expires_at: Date.now() + ATTRIBUTION_TTL_MS,
    };

    if (existing && isNonDirectTouch(touch)) attribution.last_non_direct = touch;
    attribution.expires_at = Date.now() + ATTRIBUTION_TTL_MS;
    saveAttribution(attribution);
    ensureSession();
    return attribution;
  };

  const touchFields = (prefix, touch) => {
    const result = {
      [`${prefix}_landing_page_url`]: clean(touch?.landing_page_url, 500),
      [`${prefix}_referrer`]: clean(touch?.referrer, 500),
      [`${prefix}_touch_timestamp`]: clean(touch?.timestamp, 40),
    };
    [...CAMPAIGN_KEYS, ...CLICK_ID_KEYS].forEach((key) => {
      result[`${prefix}_${key}`] = clean(touch?.[key], key.endsWith("clid") ? 256 : 200);
    });
    return result;
  };

  const getCtaLocation = () => {
    const cta = readJson(window.sessionStorage, CTA_KEY);
    return clean(cta?.location, 120);
  };

  const getAttribution = () => {
    const attribution = loadAttribution() || refreshAttribution();
    const session = ensureSession();
    const first = attribution.first_touch || createTouch();
    const last = attribution.last_non_direct || first;
    const activeCampaign = {};

    [...CAMPAIGN_KEYS, ...CLICK_ID_KEYS].forEach((key) => {
      activeCampaign[key] = clean(last?.[key] || first?.[key], key.endsWith("clid") ? 256 : 200);
    });

    return {
      landing_page_url: clean(first.landing_page_url, 500),
      referrer: clean(first.referrer, 500),
      ...activeCampaign,
      ...touchFields("first", first),
      ...touchFields("last", last),
      session_id: clean(session.session_id, 100),
      session_started_at: clean(session.started_at, 40),
      session_landing_page_url: clean(session.landing_page_url, 500),
      session_referrer: clean(session.landing_referrer, 500),
      page_url: safeUrl(window.location.href),
      page_path: safePath(),
      page_title: clean(document.title, 200),
      cta_location: getCtaLocation(),
    };
  };

  window.dataLayer = window.dataLayer || [];

  const sendDirectGa4Event = (payload) => {
    if (typeof window.gtag !== "function") return false;
    const { event, ...parameters } = payload;
    window.gtag("event", event, parameters);
    return true;
  };

  const pushEvent = (event, parameters = {}) => {
    const context = getAttribution();
    const payload = {
      event: clean(event, 80),
      session_id: context.session_id,
      page_path: context.page_path,
      page_title: context.page_title,
      ...parameters,
    };
    if (deliveryMode === "ga4") {
      sendDirectGa4Event(payload);
    } else {
      window.dataLayer.push(payload);
      if (deliveryMode === "pending") pendingDirectEvents.push(payload);
    }
    return payload;
  };

  const elementLocation = (element) => {
    const explicit = clean(element?.dataset?.ctaLocation, 120);
    if (explicit) return explicit;
    if (element?.closest?.(".mobile-sticky")) return "mobile_sticky";
    if (element?.closest?.("header")) return "header";
    if (element?.closest?.("footer")) return "footer";
    if (element?.closest?.(".seo-sidebar")) return "sidebar";
    if (element?.closest?.(".seo-hero, .hero")) return "hero";
    const section = element?.closest?.("section[id]");
    if (section?.id) return clean(section.id.replace(/[^a-z0-9_-]+/gi, "_"), 120);
    return "page_content";
  };

  const rememberEstimateCta = (element) => {
    const value = {
      location: elementLocation(element),
      text: clean(element?.textContent, 120),
      timestamp: new Date().toISOString(),
    };
    writeJson(window.sessionStorage, CTA_KEY, value);
    return value;
  };

  document.addEventListener(
    "click",
    (event) => {
      const element = event.target?.closest?.("a, button");
      if (!element) return;
      const href = clean(element.getAttribute?.("href"), 500);
      const location = elementLocation(element);
      const linkText = clean(element.textContent, 120);

      if (/^tel:/i.test(href)) {
        pushEvent("click_to_call", { link_url: href, link_text: linkText, cta_location: location });
        return;
      }

      if (/^mailto:/i.test(href)) {
        pushEvent("email_click", { link_url: href, link_text: linkText, cta_location: location });
        return;
      }

      const estimateTrigger =
        element.hasAttribute?.("data-open-estimate-modal") ||
        /(?:^|\/)#estimate$/i.test(href);
      if (!estimateTrigger) return;
      const cta = rememberEstimateCta(element);
      pushEvent("estimate_cta_click", {
        link_url: href,
        link_text: cta.text,
        cta_location: cta.location,
      });
    },
    true
  );

  const appendScript = (src) => {
    if (!src || document.querySelector?.(`script[src="${src}"]`)) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.referrerPolicy = "strict-origin-when-cross-origin";
    document.head?.append(script);
  };

  const initGtm = (containerId) => {
    if (!/^GTM-[A-Z0-9]+$/i.test(containerId)) return false;
    deliveryMode = "gtm";
    pendingDirectEvents.length = 0;
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    appendScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`);
    return true;
  };

  const initGa4 = (measurementId, googleAdsId = "") => {
    if (!/^G-[A-Z0-9]+$/i.test(measurementId)) return false;
    appendScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`);
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, { send_page_view: true });
    if (/^AW-\d+$/i.test(googleAdsId)) window.gtag("config", googleAdsId);
    deliveryMode = "ga4";
    pendingDirectEvents.splice(0).forEach(sendDirectGa4Event);
    return true;
  };

  const useDataLayerOnly = () => {
    deliveryMode = "dataLayer";
    pendingDirectEvents.length = 0;
  };

  const loadPublicConfig = async () => {
    if (typeof window.fetch !== "function") {
      useDataLayerOnly();
      return {};
    }
    try {
      const response = await window.fetch("/api/form-config", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        useDataLayerOnly();
        return {};
      }
      publicConfig = await response.json();
      const gtmId = clean(publicConfig.gtmContainerId, 40);
      const ga4Id = clean(publicConfig.ga4MeasurementId, 40);
      const adsId = clean(publicConfig.googleAdsId, 40);
      if (!initGtm(gtmId) && !initGa4(ga4Id, adsId)) useDataLayerOnly();
      return publicConfig;
    } catch {
      useDataLayerOnly();
      return {};
    }
  };

  refreshAttribution();

  window.AQGTracking = {
    getAttribution,
    pushEvent,
    refreshAttribution,
    rememberEstimateCta,
    getPublicConfig: () => ({ ...publicConfig }),
    ready: loadPublicConfig(),
  };
  window.AQGAnalytics = window.AQGAnalytics || {
    track: (event, properties = {}) => pushEvent(event, properties),
    getAttribution,
    ready: window.AQGTracking.ready,
  };
})(window);

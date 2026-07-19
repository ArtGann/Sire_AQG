# All Quality Gutters LLC

Static website ready for GitHub and Cloudflare Pages.

## Local Preview

Run `start-local.bat`, then open:

```text
http://127.0.0.1:8027/
```

## Cloudflare Pages

Use these settings:

```text
Framework preset: None
Build command: leave empty
Build output directory: /
Root directory: /
```

## Lead Webhook

The estimate form posts to `/api/lead`, a Cloudflare Pages Function that forwards leads to GoHighLevel.

Add this Cloudflare Pages environment variable (set the real value in the Cloudflare dashboard only — never commit it to the repository):

```text
GHL_WEBHOOK_URL=your_webhook_url_here
```

## Estimate Form Infrastructure

The shared calculator lives in `assets/js/estimate-core.js`. It is used by the browser, `/api/lead`, and the Node tests. The contact request can be submitted without opening the optional calculator. When opened, the Pages Function recalculates all line items, the preliminary range, and the customer-facing `Math.round(baseTotal * 1.03)` amount before sending the lead to GoHighLevel.

Configure these Cloudflare Pages bindings in the dashboard. Binding names must match exactly; they are not string environment variables:

```text
R2 binding: LEAD_PHOTOS_BUCKET -> all-quality-gutters-lead-photos
KV binding: LEAD_RATE_LIMIT_KV -> your existing lead/rate-limit namespace
```

Then configure these environment variables. Do not commit their real values:

```text
GHL_WEBHOOK_URL=<set-in-cloudflare-dashboard>
TURNSTILE_SITE_KEY=<public site key>
TURNSTILE_SECRET_KEY=<secret key>
TURNSTILE_ENFORCE=true
TURNSTILE_EXPECTED_HOSTNAMES=www.allqualitygutters.com,allqualitygutters.com
TURNSTILE_EXPECTED_ACTION=estimate_request
SUPPORTED_ZIPS=19057,19019,19103
GTM_CONTAINER_ID=GTM-XXXXXXX
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
GOOGLE_ADS_ID=AW-123456789
```

ZIP `19057` (the Levittown company/base ZIP) is always classified as `supported_area` in code so a missing dashboard value cannot downgrade the home service area. `SUPPORTED_ZIPS` is an additive, comma-separated list of other confirmed five-digit service ZIPs; malformed entries are ignored. Unlisted ZIPs in the New Jersey `07000-08999` or Pennsylvania `15000-19699` review envelopes are sent as `needs_review`, while other valid ZIPs are sent as `outside_primary_area`.

`LEAD_PHOTOS_BUCKET` remains private. `/api/upload-photo` validates and stores one file per request in R2, then returns an opaque same-origin HTTPS URL under `/api/photo/<random-id>`, which serves only JPG, PNG, and WEBP objects written by this application. No R2 access key, R2 secret, public `r2.dev` URL, custom R2 domain, or `R2_PUBLIC_BASE_URL` variable is used. The form accepts at most 10 photos up to 10MB each and sends every returned URL to GHL as both `uploaded_photos` and newline-separated `uploaded_photos_text`.

In the R2 bucket settings, add these object lifecycle rules:

- expire `lead-sessions/` after 1 day;
- expire `lead-session-photos/` after 1 day;
- expire `lead-photos/` after the retention period approved for customer project photos (90 days is the recommended starting point).

The normal no-photo form sends one Turnstile token directly to `/api/lead`, where it is validated exactly once. When photos are selected, the form first posts `idempotency_key` and `turnstile_token` to `/api/lead-session`. The returned `lead_session_token` is sent with each one-file `/api/upload-photo` request and the final `/api/lead` request. The server stores each issued URL in that verified session, and `/api/lead` rejects external, fabricated, duplicate, expired, over-limit, or cross-session URLs. Each slot has an independent 256-bit public ID, R2 create-only writes prevent replacement, and a conditional R2 session claim prevents two concurrent submissions from delivering the same photo-session lead twice.

The photo-session endpoint fails closed unless `TURNSTILE_SECRET_KEY` is present, `TURNSTILE_ENFORCE=true`, and both `TURNSTILE_EXPECTED_HOSTNAMES` and `TURNSTILE_EXPECTED_ACTION` are set. This prevents an incomplete production configuration from becoming an arbitrary upload endpoint. A static local preview does not run Pages Functions; the Node integration tests mock Turnstile and R2 without storing real credentials.

Keep `TURNSTILE_EXPECTED_ACTION=estimate_request`; `/api/form-config` gives that same action to the rendered widget. Configure both production hostnames in `TURNSTILE_EXPECTED_HOSTNAMES` exactly as shown above.

In GoHighLevel, update the SMS workflow so it sends a message only when `sms_consent == true`. The website always sends a lead and request metadata; `sms_consent_timestamp` and `sms_consent_text_version` are populated only when consent is present.

## Analytics and Lead Attribution

`assets/js/tracking.js` captures first-touch, last non-direct-touch, session, page, click-ID, and estimate CTA context without storing contact-form PII. It emits `estimate_cta_click`, `click_to_call`, and `email_click` to `dataLayer`; form code can emit additional events through `window.AQGAnalytics.track(event, properties)`.

Public analytics IDs are returned by `/api/form-config`. When `GTM_CONTAINER_ID` is set, the site loads that container. Otherwise it loads `GA4_MEASUREMENT_ID` directly and optionally configures `GOOGLE_ADS_ID`. Configure only one delivery path for the same GA4 property to avoid duplicate page views and events.

Successful lead delivery returns a stable `event_id` (the submission idempotency key) plus the server-calculated preliminary project estimate. The thank-you page emits `generate_lead` only from a confirmed, non-PII `aqg_submission_result` envelope and deduplicates it by `event_id`. The preliminary quote is sent only as `estimated_project_value`, not GA4's bidding `value`; import qualified-lead value and actual won revenue from GHL instead. A direct visit or refresh of `/thank-you.html` is not a conversion.

The GHL webhook payload includes bounded first/last attribution fields, `session_id`, page and CTA context, `gclid`, `fbclid`, `gbraid`, `wbraid`, `msclkid`, `event_id`, and `attribution_json`. Map these fields to GHL custom fields and deduplicate opportunity/workflow creation by `event_id`.

To propagate the shared form after changing `index.html`:

```text
node scripts/sync-estimate-modal.mjs
```

After changing any CSS or JS, update immutable asset references and verify them with:

```text
node scripts/sync-asset-versions.mjs
node --test
```

The main entry file is `index.html`.

## SEO Pages

The repository includes:

- five service landing pages under `/services/`;
- localized Pennsylvania and New Jersey landing pages under `/service-areas/`;
- a community directory at `/areas-we-serve/`;
- `robots.txt`, `sitemap.xml`, canonical URLs and structured data.

To refresh the location source and rebuild all generated pages:

```text
node scripts/build-seo.mjs --import
```

To rebuild from the committed location data without requesting the source site:

```text
node scripts/build-seo.mjs
```

After deployment, submit `https://www.allqualitygutters.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools. See `SEO-LAUNCH-CHECKLIST.md` for the off-site launch steps that code cannot complete.

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

Configure these Cloudflare Pages bindings and environment variables in the dashboard. Do not commit their real values:

```text
GHL_WEBHOOK_URL=<set-in-cloudflare-dashboard>
LEAD_PHOTOS_BUCKET=<R2 bucket binding>
R2_PUBLIC_BASE_URL=https://public-photo-domain
LEAD_RATE_LIMIT_KV=<KV namespace binding>
TURNSTILE_SITE_KEY=<public site key>
TURNSTILE_SECRET_KEY=<secret key>
TURNSTILE_ENFORCE=true
SUPPORTED_ZIPS=19019,19103
```

`LEAD_PHOTOS_BUCKET` stores uploads from `/api/upload-photo`; `R2_PUBLIC_BASE_URL` is the public domain that serves the uploaded files. The form accepts at most six JPG, PNG, or WEBP files up to 10MB each and sends the resulting URLs to GHL as `uploaded_photos` and `uploaded_photos_text`.

The upload endpoint requires a Turnstile token, a submission idempotency key, a KV-backed upload session, rate limits, and image magic-byte validation. It only accepts photo URLs under `R2_PUBLIC_BASE_URL` when a lead is submitted.

For local work, leave `TURNSTILE_ENFORCE` unset. In production set both Turnstile keys and `TURNSTILE_ENFORCE=true`; otherwise the server rejects requests without a valid token.

In GoHighLevel, update the SMS workflow so it sends a message only when `sms_consent == true`. The website always sends a lead, and also supplies `sms_consent_timestamp`, `sms_consent_text_version`, `request_ip`, and `user_agent` when consent is present.

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

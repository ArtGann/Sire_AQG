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

Photo upload UI stays visible, but photos are not sent yet. The webhook receives `uploaded_photos: ""`.

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

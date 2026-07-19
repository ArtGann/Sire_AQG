# SEO & Lead Generation Launch Checklist

The repository now contains the technical SEO, attribution and conversion-event foundation. Search visibility, clicks and sales still depend on verified business data, real local proof, production analytics IDs and CRM follow-up. Complete the items below after deployment.

## First 48 Hours

1. Connect the final `www.allqualitygutters.com` domain and verify that the apex domain redirects to `www` over HTTPS.
2. Verify the domain property in Google Search Console and submit `/sitemap.xml`.
3. Add the site to Bing Webmaster Tools and submit the same sitemap.
4. Inspect the homepage, `/areas-we-serve/`, all six service pages and the highest-priority regional pages in Search Console.
5. Confirm that the phone, email, address and opening hours exactly match the Google Business Profile.
6. In Cloudflare Pages, set `GTM_CONTAINER_ID` (preferred) or `GA4_MEASUREMENT_ID`, then confirm that the browser sends events in GA4 DebugView / GTM Preview.

## Local SEO

1. Fully complete the Google Business Profile: primary category, services, service area, hours, appointment URL, description and current project photos.
2. Do not create fake offices or Google profiles in cities without a staffed location.
3. Add real completed-project photos and short project notes to the relevant regional pages. This is the strongest next content upgrade because it makes each page locally distinct.
4. Ask satisfied customers for honest Google reviews and reply to every review. Never gate or manufacture reviews.
5. Keep NAP data consistent on Apple Business Connect, Bing Places, Yelp, BBB, Angi, Facebook and relevant contractor directories.

## Authority and Content

1. Seek links from suppliers, chambers of commerce, local associations and community sponsorships.
2. Publish useful homeowner guides based on actual questions: gutter sizing, guards versus cleaning, drainage near foundations, fascia damage and seasonal maintenance.
3. Link every new guide to the relevant service and regional pages.
4. Add licenses, warranties and certifications only when they can be verified.

## Measurement

1. In GTM/GA4, map `generate_lead` as the primary website conversion. It is emitted only after the server confirms the lead. Do not count a generic `/thank-you.html` page view as a conversion.
2. Create secondary events for `click_to_call`, `email_click`, `estimate_cta_click`, `estimate_form_open`, `estimate_form_start`, `estimate_calculator_open`, `estimate_submit`, `estimate_success` and `estimate_error`.
3. Import qualified-lead, appointment and closed-sale outcomes from GoHighLevel back into GA4 and the ad platforms. Optimize campaigns for qualified leads or sales, not raw form starts.
4. Confirm that GHL maps `event_id`, first/last-touch source fields and Google/Meta/Microsoft click IDs. Replays of the same `event_id` must not create duplicate opportunities or workflows.
5. In Search Console Performance, filter pages with meaningful impressions and low CTR. Compare the query to the page title, description and on-page promise before rewriting snippets.
6. Segment reports by page type, service, location, device and source. Review index coverage and Core Web Vitals monthly.
7. Expand individual city pages only when real local projects, reviews or unique service information are available. Avoid hundreds of near-duplicate doorway pages.

## Lead Operations

1. Test the current production form end to end and verify the lead, attribution, consent, `uploaded_photos` and `uploaded_photos_text` fields in GHL, not just the thank-you page. Separately test `/api/lead-session`, uploads and the final lead with 0, 1 and 10 photos.
2. Set an owner and an immediate notification workflow for every new lead. Track first-response time, contact rate, appointment rate, quote rate and close rate.
3. Configure an appointment calendar URL and add it to the thank-you experience when the GHL calendar is ready.
4. Keep SMS workflows strictly conditional on `sms_consent=true`, and retain the disclosure version, page URL and timestamp.
5. Use a GHL upsert/deduplication key based on `event_id` plus normalized phone/email so retries cannot trigger duplicate sales workflows.

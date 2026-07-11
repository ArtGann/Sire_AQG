# Services & Prices / Estimate Calculator Notes

The shared `assets/js/estimate-core.js` module is the only calculation source for the browser, Cloudflare Pages Functions, and tests.

- 5-inch gutters, downspouts, elbows, miters, and connectors: $15.
- 6-inch gutters, downspouts, elbows, miters, and connectors: $18.
- Basic guards: $15/LF; Micro-Mesh guards: $20/LF.
- Fascia: $20/LF; Soffit panel: $25/LF.

The calculator is optional. A lead submitted without requesting it has `estimate_status: not_requested` and no price. When it is requested, every selected service has its own quantity: gutters, guards, fascia, and soffit use separate LF; downspouts use count × length per unit; elbows, connectors, and miters use counts.

Whole-house gutters can use `4 × sqrt(square feet / stories)` only when stories and square feet are supplied. Downspout length defaults to `stories × 10 LF` per downspout. Elbows default to three per downspout and connectors to one per downspout. A customer-provided quantity always takes precedence.

An `I'm not sure` choice creates a manual-review lead instead of a false $0 estimate. A calculated estimate uses a ±15% range with $5, $25, or $100 rounding. The customer-facing thank-you amount is `Math.round(base total × 1.03)` and does not change rates, line items, or base total.

Final pricing always requires an on-site inspection and accurate measurements.

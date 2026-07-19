import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pages = [
  { slug: "seamless-gutter-installation", pageClass: "seamless-install-page", prices: ["$15", "$18"] },
  { slug: "gutter-guards", pageClass: "gutter-guards-page", prices: ["$15", "$20"] },
  { slug: "gutter-replacement", pageClass: "gutter-replacement-page", prices: ["$15", "$18"] },
  { slug: "soffit-fascia", pageClass: "soffit-page", prices: ["$20", "$25", "$45"] },
  { slug: "downspout-installation", pageClass: "downspout-page", prices: ["$15", "$18"] },
];

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

test("custom service pages retain their visual layouts, pricing, assets, and current lead modal", async () => {
  for (const page of pages) {
    const file = join(root, "services", page.slug, "index.html");
    const html = await readFile(file, "utf8");
    assert.match(html, /<header class="site-header">/, page.slug);
    assert.doesNotMatch(html, /<header class="seo-header">/, page.slug);
    assert.match(html, /id="primary-navigation"/, page.slug);
    assert.doesNotMatch(html, /class="[^"]*-legacy"/, page.slug);
    assert.doesNotMatch(html, /id="legacy-prices"/, page.slug);
    assert.match(html, new RegExp(`<main[^>]+class="[^"]*seamless-page[^"]*${page.pageClass}`), page.slug);
    assert.match(html, /<section[^>]+id="prices"/, page.slug);
    assert.ok((html.match(/class="seamless-price-card(?:\s|"|-)/g) || []).length >= 3, page.slug);
    for (const price of page.prices) assert.ok(html.includes(`<strong>${price}</strong>`), `${page.slug}: ${price}`);
    assert.match(html, /assets\/css\/seamless-visual-page\.css\?v=[a-f0-9]{12}/, page.slug);
    assert.match(html, /id="estimate-photos"/, page.slug);
    assert.match(html, /name="lead_session_token"/, page.slug);

    const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || "null");
    const faq = jsonLd?.["@graph"]?.find((entry) => entry?.["@type"] === "FAQPage");
    assert.ok(faq?.mainEntity?.length, `${page.slug}: FAQ schema`);
    for (const entry of faq.mainEntity) {
      assert.ok(html.includes(`<summary>${escapeHtml(entry.name)}</summary>`), `${page.slug}: ${entry.name}`);
      assert.ok(html.includes(`<p>${escapeHtml(entry.acceptedAnswer.text)}</p>`), `${page.slug}: FAQ answer`);
    }

    const assetRefs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)/g)].map((match) => match[1]);
    for (const asset of new Set(assetRefs)) await access(join(root, ...asset.slice(1).split("/")));
  }
});

test("the SEO builder cannot overwrite the five hand-built service pages", async () => {
  const builder = await readFile(join(root, "scripts", "build-seo.mjs"), "utf8");
  const protectedBlock = builder.match(/const customVisualServiceSlugs = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
  for (const page of pages) assert.ok(protectedBlock.includes(`"${page.slug}"`), page.slug);
  assert.match(builder, /if \(customVisualServiceSlugs\.has\(service\.slug\)\) continue;/);
});

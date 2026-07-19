import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (entry.name === ".git") return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
  }));
  return nested.flat();
}

test("every HTML page loads conversion tracking and excludes the local review script", async () => {
  const files = await htmlFiles(root);
  assert.equal(files.length, 42);

  for (const file of files) {
    const html = await readFile(file, "utf8");
    const trackingTags = html.match(/<script[^>]+src=["'][^"']*\/assets\/js\/tracking\.js(?:\?v=[^"']*)?["'][^>]*><\/script>/g) || [];
    assert.equal(trackingTags.length, 1, `${file} must load tracking.js exactly once`);
    assert.doesNotMatch(html, /assets\/js\/review-notes\.js/, `${file} must not load review-notes.js in production`);
  }
});

test("the thank-you page does not treat a page view as a conversion", async () => {
  const html = await readFile(join(root, "thank-you.html"), "utf8");
  assert.doesNotMatch(html, /generate_lead/);
  const script = await readFile(join(root, "assets", "js", "thank-you.js"), "utf8");
  assert.match(script, /result\.confirmed === true/);
  assert.match(script, /AQGAnalytics\.track\("generate_lead"/);
});

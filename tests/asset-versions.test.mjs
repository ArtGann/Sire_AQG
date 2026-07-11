import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await readFile(join(root, "assets/asset-versions.json"), "utf8"));
async function htmlFiles(directory) { const entries = await readdir(directory, { withFileTypes: true }); return (await Promise.all(entries.map((entry) => entry.isDirectory() ? htmlFiles(join(directory, entry.name)) : entry.name.endsWith(".html") ? [join(directory, entry.name)] : []))).flat(); }

test("all HTML pages use current, consistent versions for shared estimate assets", async () => {
  const pages = await htmlFiles(root);
  for (const [asset, version] of Object.entries(manifest)) {
    const actual = createHash("sha256").update(await readFile(join(root, asset))).digest("hex").slice(0, 12);
    assert.equal(version, actual, `${asset} changed; run npm run sync:assets`);
    const basename = asset.split("/").at(-1).replace(".", "\\.");
    const uses = await Promise.all(pages.map(async (page) => (await readFile(page, "utf8")).match(new RegExp(`${basename}\\?v=([^"']+)`, "g")) || []));
    const matches = uses.flat();
    if (matches.length) assert.ok(matches.every((match) => match.endsWith(`?v=${version}`)), `${asset} has stale references`);
  }
});

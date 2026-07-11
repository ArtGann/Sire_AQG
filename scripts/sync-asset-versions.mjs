import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const cssFiles = (await readdir(join(root, "assets", "css"))).filter((file) => file.endsWith(".css")).map((file) => `assets/css/${file}`);
const jsFiles = (await readdir(join(root, "assets", "js"))).filter((file) => file.endsWith(".js")).map((file) => `assets/js/${file}`);
const assets = [...cssFiles, ...jsFiles];
const version = async (asset) => createHash("sha256").update(await readFile(join(root, asset))).digest("hex").slice(0, 12);
const versions = Object.fromEntries(await Promise.all(assets.map(async (asset) => [asset, await version(asset)])));
async function files(dir) { const entries = await readdir(dir, { withFileTypes: true }); return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith(".html") ? [join(dir, entry.name)] : []))).flat(); }
for (const file of await files(root)) {
  const html = await readFile(file, "utf8");
  let updated = html;
  for (const [asset, hash] of Object.entries(versions)) {
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    updated = updated.replace(new RegExp(`(${escaped.replace(/^assets/, "/assets")}|${escaped})(?:\\?v=[^"']*)?`, "g"), (match, url) => `${url}?v=${hash}`);
  }
  if (updated !== html) await writeFile(file, updated, "utf8");
}
await writeFile(join(root, "assets", "asset-versions.json"), `${JSON.stringify(versions, null, 2)}\n`, "utf8");
console.log("Synchronized hashed asset versions.");

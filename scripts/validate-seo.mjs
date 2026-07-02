import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selfPath = fileURLToPath(import.meta.url);
const skip = new Set([".git", "node_modules", ".claude"]);
const errors = [];
const indexableCanonicals = new Set();
const seenTitles = new Map();
const seenDescriptions = new Map();
const seenCanonicals = new Map();
// "Delaware County" and "Delaware Water Gap" are Pennsylvania places and must
// not trip the out-of-state coverage check.
const excludedCoveragePattern = /,\s*(?:MD|DE|VA)\b|(?:across|throughout|coverage includes)[^<]{0,160}\b(?:Maryland|Delaware(?!\s+(?:County|Water))|Virginia)\b|areaServed[^<]{0,500}"(?:Maryland|Delaware|Virginia)"/i;
// Text files that ship to the repo or the client must never contain live
// webhook endpoints. The validator file itself is excluded because it holds
// these detection patterns.
const secretPatterns = [
  [/https:\/\/services\.leadconnectorhq\.com\/hooks\//i, "GoHighLevel webhook URL"],
  [/GHL_WEBHOOK_URL\s*=\s*https:/i, "webhook URL assigned in plain text"],
];
const secretScanExtensions = new Set([".html", ".md", ".txt", ".js", ".mjs", ".json", ".css", ".xml", ".bat"]);

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

function count(html, pattern) {
  return [...html.matchAll(pattern)].length;
}

// Search engines measure rendered characters, so decode entities before
// checking title and description lengths.
function decodeEntities(value) {
  return value.replace(/&amp;/g, "&").replace(/&#0?39;|&#x27;/gi, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");
}

function fileForUrl(url) {
  const clean = url.split(/[?#]/)[0];
  if (!clean || clean === "/") return path.join(root, "index.html");
  const relative = clean.replace(/^\//, "");
  return clean.endsWith("/") ? path.join(root, relative, "index.html") : path.join(root, relative);
}

async function existsForUrl(url) {
  return fs.access(fileForUrl(url)).then(() => true, () => false);
}

// The canonical every indexable page is expected to declare, derived from its
// location on disk: index.html -> /, dir/index.html -> /dir/.
function expectedCanonical(relative) {
  if (relative === "index.html") return "https://www.allqualitygutters.com/";
  if (relative.endsWith("/index.html")) return `https://www.allqualitygutters.com/${relative.slice(0, -"index.html".length)}`;
  return null;
}

const idCache = new Map();
async function idsForFile(file) {
  if (!idCache.has(file)) {
    const html = await fs.readFile(file, "utf8").catch(() => "");
    idCache.set(file, new Set([...html.matchAll(/id=["']([^"']+)["']/g)].map((match) => match[1])));
  }
  return idCache.get(file);
}

const files = await walk(root);
const htmlFiles = files.filter((file) => file.endsWith(".html"));

for (const file of htmlFiles) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const html = await fs.readFile(file, "utf8");
  const noindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  if (count(html, /<title\b/gi) !== 1) errors.push(`${relative}: expected exactly one title`);
  if (count(html, /<h1\b/gi) !== 1) errors.push(`${relative}: expected exactly one h1`);
  if (!noindex && !/<meta[^>]+name=["']description["']/i.test(html)) errors.push(`${relative}: missing meta description`);
  if (!noindex && !/<link[^>]+rel=["']canonical["']/i.test(html)) errors.push(`${relative}: missing canonical`);
  if (!noindex && excludedCoveragePattern.test(html)) errors.push(`${relative}: contains coverage outside Pennsylvania or New Jersey`);

  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/\s+/g, " ").trim() ?? "");
  if (title && !noindex) {
    if (title.length < 20 || title.length > 70) errors.push(`${relative}: title length is ${title.length}; expected 20-70 characters`);
    if (seenTitles.has(title)) errors.push(`${relative}: duplicate title also used by ${seenTitles.get(title)}`);
    seenTitles.set(title, relative);
  }

  const description = decodeEntities(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1].trim() ?? "");
  if (!noindex && description) {
    if (description.length < 80 || description.length > 180) errors.push(`${relative}: meta description length is ${description.length}; expected 80-180 characters`);
    if (seenDescriptions.has(description)) errors.push(`${relative}: duplicate meta description also used by ${seenDescriptions.get(description)}`);
    seenDescriptions.set(description, relative);
  }

  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1];
  if (!noindex && canonical) {
    if (!canonical.startsWith("https://www.allqualitygutters.com/")) errors.push(`${relative}: canonical must use the preferred HTTPS www origin`);
    const expected = expectedCanonical(relative);
    if (expected && canonical !== expected) errors.push(`${relative}: canonical is ${canonical}; expected ${expected}`);
    if (seenCanonicals.has(canonical)) errors.push(`${relative}: duplicate canonical also used by ${seenCanonicals.get(canonical)}`);
    seenCanonicals.set(canonical, relative);
    indexableCanonicals.add(canonical);
  }

  for (const script of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(script[1]); } catch (error) { errors.push(`${relative}: invalid JSON-LD (${error.message})`); }
  }

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\balt=/.test(match[0])) errors.push(`${relative}: img without alt attribute (${match[0].slice(0, 80)}...)`);
  }

  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
    const url = match[1];
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(url)) continue;
    const [pathPart, fragment] = url.split("#");
    const normalized = !pathPart ? `/${relative}`.replace(/\/index\.html$/, "/").replace(/^\/index\.html$/, "/")
      : pathPart.startsWith("/") ? pathPart
      : `/${path.posix.normalize(path.posix.join(path.posix.dirname(`/${relative}`), pathPart))}`;
    if (!await existsForUrl(normalized)) {
      errors.push(`${relative}: broken local reference ${url}`);
      continue;
    }
    if (fragment) {
      const targetIds = await idsForFile(pathPart ? fileForUrl(normalized) : file);
      if (!targetIds.has(fragment)) errors.push(`${relative}: broken anchor ${url} (no id="${fragment}" in target)`);
    }
  }
}

const sitemap = await fs.readFile(path.join(root, "sitemap.xml"), "utf8");
const sitemapUrls = new Set();
for (const match of sitemap.matchAll(/<loc>https:\/\/www\.allqualitygutters\.com([^<]*)<\/loc>/g)) {
  const absolute = `https://www.allqualitygutters.com${match[1]}`;
  if (sitemapUrls.has(absolute)) errors.push(`sitemap.xml: duplicate URL ${absolute}`);
  sitemapUrls.add(absolute);
  if (!await existsForUrl(match[1])) errors.push(`sitemap.xml: missing page for ${match[1]}`);
}
if (/(?:maryland|delaware|-(?:md|va)\/)/i.test(sitemap)) errors.push("sitemap.xml: contains a location outside Pennsylvania or New Jersey");
for (const canonical of indexableCanonicals) {
  if (!sitemapUrls.has(canonical)) errors.push(`sitemap.xml: missing indexable canonical ${canonical}`);
}
for (const url of sitemapUrls) {
  if (!indexableCanonicals.has(url)) errors.push(`sitemap.xml: ${url} does not match any indexable page canonical`);
}

for (const file of files) {
  if (path.resolve(file) === selfPath) continue;
  if (!secretScanExtensions.has(path.extname(file).toLowerCase())) continue;
  const content = await fs.readFile(file, "utf8").catch(() => "");
  for (const [pattern, label] of secretPatterns) {
    if (pattern.test(content)) errors.push(`${path.relative(root, file).replaceAll("\\", "/")}: contains a ${label}; replace it with a placeholder`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`SEO validation passed for ${htmlFiles.length} HTML pages (titles, descriptions, canonicals, H1s, schema, links, anchors, alt text, sitemap, secrets).`);
}

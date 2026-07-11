import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const startMarker = "<!-- Shared estimate modal -->";
const endMarker = "<!-- /Shared estimate modal -->";
const source = await readFile(join(root, "index.html"), "utf8");
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error("Shared estimate modal markers were not found in index.html.");
const shared = source.slice(start, end + endMarker.length);

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
  }));
  return nested.flat();
}

let changed = 0;
for (const file of await htmlFiles(root)) {
  if (file === join(root, "index.html")) continue;
  const html = await readFile(file, "utf8");
  const fileStart = html.indexOf(startMarker);
  const fileEnd = html.indexOf(endMarker, fileStart);
  if (fileStart < 0 || fileEnd < 0) continue;
  const updated = html.slice(0, fileStart) + shared + html.slice(fileEnd + endMarker.length);
  if (updated !== html) {
    await writeFile(file, updated, "utf8");
    changed += 1;
  }
}
console.log(`Synchronized the shared estimate modal in ${changed} HTML files.`);

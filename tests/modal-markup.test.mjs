import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFile(join(root, file), "utf8");

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
  }));
  return nested.flat();
}

test("stories and square feet remain in the first request block in the required order", async () => {
  const html = await read("index.html");
  const labels = ["Full Name", "Phone Number", "Email Address", "ZIP Code", "Home Stories", "Square Feet", "Service Needed", "Property Address", "Preferred Date", "Message / Project Details", "Upload Photos of Your Home"];
  const positions = labels.map((label) => html.indexOf(label));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.match(html, /name="stories"[^>]*placeholder="Home Stories"(?![^>]*required)/);
  assert.match(html, /name="square_feet"[^>]*placeholder="Square Feet"(?![^>]*required)/);
});

test("only the simplified calculator controls are present across synchronized pages", async () => {
  const legacy = [/Gutter Coverage/, /Gutter Length/, /Guard Coverage/, /Downspout Details/, /Downspout Length/, /Elbows \(/, /Accessory Details/, /gutter_lf_source/, /guard_lf/, /downspout_length_per_unit/, /elbow_count/, /downspout_connector_count/, /Gutter Miters & Downspout Connectors/];
  for (const file of await htmlFiles(root)) {
    const html = await readFile(file, "utf8");
    legacy.forEach((pattern) => assert.doesNotMatch(html, pattern, file));
  }
});

test("calculator close resets its flag and calculator cards do not overwrite Service Needed", async () => {
  const script = await read("assets/js/estimate-modal.js");
  assert.match(script, /calculatorFlag\.value = opened \? "true" : "false"/);
  assert.doesNotMatch(script, /setService\(/);
  assert.doesNotMatch(script, /Gutter Miters & Downspout Connectors/);
  assert.doesNotMatch(script, /document\.createElement\("section"\)/);
});

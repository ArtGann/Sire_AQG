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

test("primary request fields start with service, ZIP, and phone", async () => {
  const html = await read("index.html");
  const labels = ["Service Needed", "ZIP Code", "Phone Number", "Full Name", "Email Address", "Property Address"];
  const positions = labels.map((label) => html.indexOf(label));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);

  const calculatorPosition = html.indexOf('id="estimate-calculator-section"');
  assert.ok(html.indexOf("Home Stories") > calculatorPosition);
  assert.ok(html.indexOf("Square Feet") > calculatorPosition);
  const storiesInput = html.match(/<input[^>]*name="stories"[^>]*>/)?.[0] || "";
  const squareFeetInput = html.match(/<input[^>]*name="square_feet"[^>]*>/)?.[0] || "";
  assert.ok(storiesInput);
  assert.ok(squareFeetInput);
  assert.doesNotMatch(storiesInput, /\brequired\b/);
  assert.doesNotMatch(squareFeetInput, /\brequired\b/);
});

test("optional photo uploads use the verified lead-session flow", async () => {
  const html = await read("index.html");
  const script = await read("assets/js/estimate-modal.js");
  const mainScript = await read("assets/js/main.js");

  assert.match(html, /<details class="estimate-optional-details">[\s\S]*name="preferred_date"[\s\S]*name="message"[\s\S]*<\/details>/);
  assert.match(html, /name="lead_session_token"[^>]*type="hidden"/);
  assert.match(html, /id="estimate-photos"[^>]*type="file"[^>]*accept="\.jpg,\.jpeg,\.png,\.webp,image\/jpeg,image\/png,image\/webp"[^>]*multiple/);
  assert.match(html, /Up to 10 photos/);
  assert.match(html, /Maximum 10MB per photo/);
  assert.doesNotMatch(html, /data-photo-handoff/);
  assert.match(script, /fetch\("\/api\/lead-session"/);
  assert.match(script, /fetch\("\/api\/upload-photo"/);
  assert.match(script, /body\.append\("photo_slot"/);
  assert.match(script, /payload\.lead_session_token = session\.token/);
  assert.match(script, /payload\.uploaded_photos = await photoUpload\.uploadAll/);
  assert.match(script, /if \(photoUpload\?\.hasPhotos\(\) \|\| activeLeadSession\)/);
  assert.match(script, /safeSessionStorage\("remove", "aqgLead"\)/);
  assert.match(script, /const conversionStored = safeSessionStorage\("set", "aqg_submission_result"/);
  assert.match(script, /if \(!conversionStored\)[\s\S]*trackAnalytics\("generate_lead"/);
  assert.match(script, /else if \(!activeLeadSession\) resetTurnstileChallenge\(\)/);
  assert.match(script, /error\.code = result\.code \|\| "lead_request_failed"/);
  assert.match(mainScript, /error\.code = result\.code \|\| "lead_request_failed"/);
  assert.match(script, /"lead_session_expired"[\s\S]*"photo_slot_used"[\s\S]*discardLeadSession\(\{ regenerateId: true \}\)/);
  assert.match(script, /activeLeadSession = null[\s\S]*setLeadSessionField\(""\)[\s\S]*clearUploadedUrls\(\)[\s\S]*resetTurnstileChallenge\(\)/);
  assert.doesNotMatch(script, /sessionStorage\.(?:setItem|removeItem)\("aqgLead"/);

  for (const file of await htmlFiles(root)) {
    const page = await readFile(file, "utf8");
    if (!page.includes("<!-- Shared estimate modal -->")) continue;
    assert.match(page, /id="estimate-photos"/, file);
    assert.match(page, /name="lead_session_token"/, file);
  }
});

test("only the simplified calculator controls are present across synchronized pages", async () => {
  const legacy = [/Gutter Coverage/, /Gutter Length/, /Guard Coverage/, /Downspout Details/, /Downspout Length/, /Elbows \(/, /Accessory Details/, /gutter_lf_source/, /guard_lf/, /downspout_length_per_unit/, /elbow_count/, /downspout_connector_count/];
  for (const file of await htmlFiles(root)) {
    const html = await readFile(file, "utf8");
    legacy.forEach((pattern) => assert.doesNotMatch(html, pattern, file));
  }
});

test("calculator close resets its flag and service pages can preselect without overwriting user choices", async () => {
  const script = await read("assets/js/estimate-modal.js");
  assert.match(script, /calculatorFlag\.value = opened \? "true" : "false"/);
  assert.doesNotMatch(script, /setService\(/);
  assert.match(script, /preselectServiceFromPath/);
  assert.match(script, /selectedOptions[\s\S]*some\(\(option\) => option\.value\)/);
  assert.match(script, /\/services\/gutter-guards\//);
  assert.doesNotMatch(script, /document\.createElement\("section"\)/);
});

import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("browser storage failures cannot abort or reverse a confirmed lead", async () => {
  const script = await readFile(join(root, "assets", "js", "estimate-modal.js"), "utf8");
  const functionSource = script.match(/const safeSessionStorage = \(operation, key, value = ""\) => \{[\s\S]*?\n  \};/)?.[0];
  assert.ok(functionSource, "safe storage helper must exist");

  const throwingStorage = {
    setItem() { throw new DOMException("blocked", "SecurityError"); },
    removeItem() { throw new DOMException("blocked", "SecurityError"); },
  };
  const safeStorage = vm.runInNewContext(`(() => { ${functionSource}; return safeSessionStorage; })()`, {
    sessionStorage: throwingStorage,
    DOMException,
  });
  assert.equal(safeStorage("remove", "aqgLead"), false);
  assert.equal(safeStorage("set", "aqg_submission_result", "{}"), false);

  const postPosition = script.indexOf("const serverResult = await postPayload(payload)");
  const storePosition = script.indexOf('safeSessionStorage("set", "aqg_submission_result"');
  const redirectPosition = script.indexOf("await redirectToThankYou(form)");
  assert.ok(postPosition >= 0 && storePosition > postPosition && redirectPosition > storePosition);
  assert.match(script, /if \(!conversionStored\)[\s\S]*trackAnalytics\("generate_lead"/);
});

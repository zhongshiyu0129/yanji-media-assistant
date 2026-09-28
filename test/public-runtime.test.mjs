import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPublicRuntime } from "../server/public-runtime.mjs";

function responseStub() {
  const headers = new Map();
  return {
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); }
  };
}

test("public runtime gives each signed browser session isolated projects and memory", async () => {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "yanji-public-"));
  const runtime = createPublicRuntime(process.cwd(), {
    enabled: true,
    secret: "test-secret-with-at-least-24-characters",
    dataRoot
  });
  const firstResponse = responseStub();
  const first = runtime.context({ headers: {} }, firstResponse);
  const cookie = firstResponse.getHeader("set-cookie").split(";")[0];
  const same = runtime.context({ headers: { cookie } }, responseStub());
  const other = runtime.context({ headers: {} }, responseStub());

  assert.equal(first.sessionId, same.sessionId);
  assert.notEqual(first.sessionId, other.sessionId);
  assert.equal(first.store, same.store);
  assert.notEqual(first.store, other.store);
  assert.notEqual(first.memoryPath, other.memoryPath);
});

test("public runtime refuses public mode without a strong signing secret", () => {
  assert.throws(
    () => createPublicRuntime(process.cwd(), { enabled: true, secret: "too-short" }),
    /APP_SECRET/
  );
});

test("public runtime stops AI calls at the configured daily limit", async () => {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "yanji-quota-"));
  const runtime = createPublicRuntime(process.cwd(), {
    enabled: true,
    secret: "another-test-secret-with-24-characters",
    dataRoot,
    limits: { aiPerSession: 1, aiTotal: 5 }
  });
  await runtime.consume("a-session", "ai");
  await assert.rejects(() => runtime.consume("a-session", "ai"), /体验次数已用完/);
});

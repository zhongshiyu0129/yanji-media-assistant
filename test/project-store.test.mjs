import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertProjectId, createProjectStore, normalizeSlug } from "../server/project-store.mjs";

test("normalizeSlug keeps useful Chinese and latin characters", () => {
  assert.equal(normalizeSlug(" 2026-09-12 清史选题 "), "2026-09-12-清史选题");
});

test("assertProjectId rejects traversal", () => {
  assert.throws(() => assertProjectId("../private"), /不合法/);
  assert.throws(() => assertProjectId("a/b"), /不合法/);
});

test("assertProjectId accepts generated project names", () => {
  assert.equal(assertProjectId("2026-09-12-eight-banner-surnames"), "2026-09-12-eight-banner-surnames");
});

test("new projects include a persistent writing workspace", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "yanji-store-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = createProjectStore(root);

  const project = await store.create({
    name: "new-script",
    title: "一篇新稿"
  });
  const workspace = JSON.parse(project.files.workspace.content);

  assert.equal(workspace.accountName, "你的账号");
  assert.equal(workspace.currentStage, "source");
  assert.deepEqual(workspace.settings, { targetLength: 1800, specialInstructions: "", stageInstructions: {} });
  assert.deepEqual(workspace.metadata, { domain: "", tags: [], generated: false });
  assert.deepEqual(workspace.publish, { titles: [], descriptions: [], tags: [], comments: [], pronunciations: [] });
  assert.deepEqual(workspace.conversation, []);
  assert.doesNotMatch(project.files.original.content, /请在这里粘贴/);

  const updated = await store.updateMetadata(project.id, {
    title: "我最后确定的标题",
    domain: "历史",
    tags: ["清史", "姓氏文化"]
  });
  assert.equal(updated.title, "我最后确定的标题");
  assert.equal(updated.domain, "历史");
  assert.deepEqual(updated.tags, ["清史", "姓氏文化"]);

  const removed = await store.remove(project.id);
  assert.equal(removed.recoverable, true);
  assert.deepEqual(await store.list(), []);
});

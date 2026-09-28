import test from "node:test";
import assert from "node:assert/strict";
import { evidenceQuery, fetchSourcePreview } from "../server/source-preview.mjs";

test("evidence query preserves user-provided Chinese fact phrases", () => {
  const query = evidenceQuery("穷养儿志 富养女德 古籍 出处");
  assert.match(query, /穷养儿志/u);
  assert.match(query, /富养女德/u);
});

test("source preview rejects local and private addresses", async () => {
  await assert.rejects(() => fetchSourcePreview({ url: "http://127.0.0.1/private" }), /无法预览/);
  await assert.rejects(() => fetchSourcePreview({ url: "http://localhost/private" }), /无法预览/);
});

test("source preview only accepts web URLs", async () => {
  await assert.rejects(() => fetchSourcePreview({ url: "file:///etc/passwd" }), /只支持网页链接/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { fetchSourcePreview } from "../server/source-preview.mjs";

test("source preview rejects local and private addresses", async () => {
  await assert.rejects(() => fetchSourcePreview({ url: "http://127.0.0.1/private" }), /无法预览/);
  await assert.rejects(() => fetchSourcePreview({ url: "http://localhost/private" }), /无法预览/);
});

test("source preview only accepts web URLs", async () => {
  await assert.rejects(() => fetchSourcePreview({ url: "file:///etc/passwd" }), /只支持网页链接/);
});

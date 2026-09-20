import test from "node:test";
import assert from "node:assert/strict";
import { fallbackResearchPlan } from "../server/research-service.mjs";

test("fallback research plan preserves user queries and adds verification angles", () => {
  const plan = fallbackResearchPlan({
    claim: "钮祜禄氏后来多改姓郎",
    query: "钮祜禄 改姓 郎",
    queries: ["钮祜禄氏 姓氏演变", "钮祜禄 改姓 争议"]
  });

  assert.equal(plan.claims.length, 1);
  assert.equal(plan.claims[0].text, "钮祜禄氏后来多改姓郎");
  assert.ok(plan.claims[0].queries.includes("钮祜禄 改姓 郎"));
  assert.ok(plan.claims[0].queries.some((query) => query.includes("是否属实")));
  assert.equal(new Set(plan.claims[0].queries).size, plan.claims[0].queries.length);
  assert.ok(plan.claims[0].queries.length <= 5);
});

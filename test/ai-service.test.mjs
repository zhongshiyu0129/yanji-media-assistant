import test from "node:test";
import assert from "node:assert/strict";
import { createAIService } from "../server/ai-service.mjs";

test("AI service requires a key before sending text", async () => {
  const previousOpenAI = process.env.OPENAI_API_KEY;
  const previousDeepSeek = process.env.DEEPSEEK_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  try {
    const service = createAIService("/tmp/yanji-missing-context");
    await assert.rejects(
      service.run({ stage: "source", payload: { source: "足够长度的待整理口播稿内容" } }),
      /API Key/
    );
  } finally {
    if (previousOpenAI === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAI;
    if (previousDeepSeek === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousDeepSeek;
  }
});

test("AI service uses DeepSeek JSON Output", async (context) => {
  const originalFetch = global.fetch;
  let requestBody;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      model: "deepseek-flash",
      usage: { total_tokens: 123 },
      choices: [{ message: { content: JSON.stringify({ corrected: "整理后的口播稿" }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const service = createAIService("/tmp/yanji-missing-context");
  const response = await service.run({
    apiKey: "test-key",
    provider: "deepseek",
    stage: "source",
    model: "deepseek-flash",
    payload: { source: "这是一段需要整理的测试口播稿，长度足够完成接口测试。" }
  });

  assert.equal(response.result.corrected, "　　整理后的口播稿");
  assert.doesNotMatch(response.result.corrected, /\n\n/u);
  assert.equal(response.usage.total_tokens, 123);
  assert.equal(requestBody.response_format.type, "json_object");
  assert.equal(requestBody.thinking.type, "disabled");
  assert.equal(requestBody.model, "deepseek-flash");
});

test("AI metadata stage returns a sidebar title and domain tags", async (context) => {
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => new Response(JSON.stringify({
    model: "deepseek-flash",
    choices: [{ message: { content: '{"title":"黄河流域地理故事","domain":"地理","tags":["黄河","流域文化"]}' } }]
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const service = createAIService("/tmp/yanji-missing-context");
  const response = await service.run({
    apiKey: "test-key", provider: "deepseek", stage: "metadata",
    payload: { source: "这是一段讲述黄河流域地理变化与沿岸文化的口播稿。" }
  });

  assert.equal(response.result.title, "黄河流域地理故事");
  assert.equal(response.result.domain, "地理");
  assert.deepEqual(response.result.tags, ["黄河", "流域文化"]);
});

test("fact detection does not search until the user requests verification", async (context) => {
  const originalFetch = global.fetch;
  let requestBody;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      model: "gpt-5.4-mini",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ factChecks: [{
        claim: "这是一句待核验事实", sourceQuery: "一句 待核验 事实", searchQueries: ["直接查询", "权威来源", "反向证据"],
        confidence: 70, level: "recommended", summary: "涉及客观事实", suggestion: "改成审慎说法",
        sources: [{ title: "模型自行附带的来源", url: "https://example.com", excerpt: "不应保留" }]
      }] }) }] }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const service = createAIService("/tmp/yanji-missing-context");
  const response = await service.run({ apiKey: "test-key", provider: "openai", stage: "facts", payload: { draft: "需要查证的一段历史口播稿。" } });

  assert.equal(requestBody.tools, undefined);
  assert.equal(requestBody.include, undefined);
  assert.deepEqual(response.result.factChecks[0].sources, []);
});

test("rewrite is automatically recalibrated to the requested length and large paragraphs", async (context) => {
  const originalFetch = global.fetch;
  let calls = 0;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => {
    calls += 1;
    const rewrite = calls === 1
      ? "第一版太短。只有这一点内容。"
      : `${"这是补充后的完整口播内容，包含背景、原因、例子和解释。".repeat(25)}收束全文。`;
    return new Response(JSON.stringify({
      model: "deepseek-flash",
      usage: { total_tokens: 100 },
      choices: [{ message: { content: JSON.stringify({ rewrite }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const service = createAIService("/tmp/yanji-missing-context");
  const response = await service.run({
    apiKey: "test-key", provider: "deepseek", stage: "rewrite",
    payload: { corrected: "一段需要改写的参考稿内容，长度足以开始测试。", settings: { targetLength: 700 } }
  });

  assert.equal(calls, 2);
  assert.equal(response.adjustedToTarget, true);
  assert.ok(Math.abs(response.finalLength - 700) < 100);
  assert.doesNotMatch(response.result.rewrite, /\n\n/);
  assert.ok(response.result.rewrite.split("\n").every((paragraph) => paragraph.startsWith("　　")));
  assert.equal(response.usage.total_tokens, 200);
});

test("project chat returns a persistent co-writing reply", async (context) => {
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => new Response(JSON.stringify({
    model: "deepseek-flash",
    choices: [{ message: { content: '{"reply":"记住了，这一篇的结尾会更克制。"}' } }]
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const service = createAIService("/tmp/yanji-missing-context");
  const response = await service.run({
    apiKey: "test-key", provider: "deepseek", stage: "chat",
    payload: { draft: "一段正在修改的完整口播稿。", currentStage: "openings", message: "结尾克制一点", conversation: [] }
  });
  assert.match(response.result.reply, /结尾会更克制/);
});

test("review-card chat returns an editable replacement suggestion", async (context) => {
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => new Response(JSON.stringify({
    model: "deepseek-flash",
    choices: [{ message: { content: '{"reply":"已改得更有边界。","suggestion":"许多家族逐渐采用了更常见的汉姓形式。"}' } }]
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const service = createAIService("/tmp/yanji-missing-context");
  const response = await service.run({
    apiKey: "test-key", provider: "deepseek", stage: "suggestion",
    payload: { kind: "fact", claim: "全都改了汉姓", suggestion: "很多人改姓", message: "不要说得太绝对" }
  });
  assert.match(response.result.reply, /更有边界/);
  assert.match(response.result.suggestion, /许多家族/);
});

test("selected-text edit returns an in-place replacement", async (context) => {
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => new Response(JSON.stringify({
    model: "deepseek-flash",
    choices: [{ message: { content: '{"reply":"已压缩并保留信息点。","replacement":"八旗不只是一支军队。"}' } }]
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  const service = createAIService("/tmp/yanji-missing-context");
  const response = await service.run({ apiKey: "test-key", provider: "deepseek", stage: "selection", payload: { before: "前文", selected: "八旗只是一支由八种旗色组成的军队。", after: "后文", message: "缩短" } });
  assert.equal(response.result.replacement, "八旗不只是一支军队。");
});

test("source review removes topic-only search results", async (context) => {
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => new Response(JSON.stringify({
    model: "deepseek-flash",
    choices: [{ message: { content: '{"answer":"只有第二条直接证明改姓关系。","selected":[{"index":1,"relation":"supports","reason":"正文明确写出瓜尔佳氏改用关姓"}]}' } }]
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  const service = createAIService("/tmp/yanji-missing-context");
  const response = await service.run({
    apiKey: "test-key", provider: "deepseek", stage: "sourceReview",
    payload: {
      claim: "瓜尔佳氏后来大多改姓关", query: "瓜尔佳氏 改姓 关",
      sources: [{ title: "鳌拜生平", excerpt: "鳌拜是清初大臣" }, { title: "满族姓名", evidence: { highlight: "瓜尔佳氏后来多改用关姓" } }]
    }
  });
  assert.deepEqual(response.result.selected.map((item) => item.index), [1]);
});

test("search planning splits a compound claim into independently searchable facts", async (context) => {
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => new Response(JSON.stringify({
    model: "deepseek-flash",
    choices: [{ message: { content: JSON.stringify({
      summary: "分开核验姓氏来源和改姓情况",
      claims: [
        { id: "C1", text: "钮祜禄在满语中有狼的含义", queries: ["钮祜禄 满语 狼 词义", "钮祜禄 满语 词源 官方", "钮祜禄 不是狼"] },
        { id: "C2", text: "钮祜禄氏后来多改姓郎", queries: ["钮祜禄氏 改姓 郎", "满族 姓氏 钮祜禄 郎 文献", "钮祜禄氏 改姓 争议"] }
      ]
    }) } }]
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const service = createAIService("/tmp/yanji-missing-context");
  const response = await service.run({
    apiKey: "test-key", provider: "deepseek", stage: "searchPlan",
    payload: { claim: "钮祜禄是狼的意思，后来大多改姓郎" }
  });

  assert.equal(response.result.claims.length, 2);
  assert.match(response.result.claims[0].text, /含义/);
  assert.ok(response.result.claims.every((item) => item.queries.length >= 3));
});

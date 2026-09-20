import { searchWebSources } from "./source-preview.mjs";

function clean(value = "") {
  return String(value).replace(/\s+/gu, " ").trim();
}

function unique(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

export function fallbackResearchPlan({ claim = "", query = "", queries = [] } = {}) {
  const text = clean(claim || query);
  const plannedQueries = unique([query, ...queries, `${text} 官方 资料`, `${text} 是否属实`, text]).slice(0, 5);
  return {
    summary: "使用原始声明生成支持、权威来源和反向核验查询。",
    claims: [{ id: "C1", text, queries: plannedQueries }]
  };
}

function normalizePlan(result, fallback) {
  const claims = (result?.claims || []).map((item, index) => ({
    id: clean(item.id) || `C${index + 1}`,
    text: clean(item.text),
    queries: unique(item.queries).slice(0, 5)
  })).filter((item) => item.text && item.queries.length).slice(0, 4);
  return claims.length ? { summary: clean(result.summary), claims } : fallback;
}

export function createResearchService(ai) {
  return {
    async run({ claim, query, queries = [], searchApiKey, aiKey, provider, model, onProgress = async () => {} }) {
      const fallback = fallbackResearchPlan({ claim, query, queries });
      const configuredAI = Boolean(aiKey) || ai.status().configured;
      let plan = fallback;
      let planningNote = "当前未配置 AI，使用规则化检索计划。";

      await onProgress({ percent: 5, label: "正在理解待核验事实", detail: "识别人物、时间、关系与需要证明的结论" });
      if (configuredAI) {
        try {
          const planned = await ai.run({
            apiKey: aiKey,
            provider: aiKey ? provider : undefined,
            model,
            stage: "searchPlan",
            payload: { claim, query, queries }
          });
          plan = normalizePlan(planned.result, fallback);
          planningNote = plan.summary || "AI 已拆分事实并生成多角度查询。";
        } catch (error) {
          planningNote = `AI 查询规划失败，已切换规则化计划：${error.message}`;
        }
      }

      await onProgress({ percent: 18, label: `已拆成 ${plan.claims.length} 个独立事实`, detail: planningNote });
      const trace = [];
      const accepted = [];

      for (let index = 0; index < plan.claims.length; index += 1) {
        const atomic = plan.claims[index];
        const startPercent = 22 + Math.round((index / Math.max(1, plan.claims.length)) * 52);
        await onProgress({
          percent: startPercent,
          label: `正在检索事实 ${index + 1}/${plan.claims.length}`,
          detail: `${atomic.text} · ${atomic.queries.length} 组支持、反驳与权威来源查询`
        });

        let candidates = [];
        let error = "";
        try {
          candidates = await searchWebSources(atomic.queries[0] || atomic.text, {
            serperApiKey: searchApiKey,
            queries: atomic.queries.slice(1)
          });
        } catch (searchError) {
          error = searchError.message;
        }

        await onProgress({
          percent: Math.min(78, startPercent + 12),
          label: `已读取事实 ${index + 1} 的候选网页`,
          detail: candidates.length ? `有 ${candidates.length} 个来源通过正文证据门槛，正在独立复核` : "没有候选网页通过正文证据门槛"
        });

        let answer = candidates.length ? "正文证据相关性检查已通过。" : "没有找到能直接证明该事实的网页正文。";
        let selected = candidates;
        if (configuredAI && candidates.length) {
          try {
            const reviewed = await ai.run({
              apiKey: aiKey,
              provider: aiKey ? provider : undefined,
              model,
              stage: "sourceReview",
              payload: { claim: atomic.text, query: atomic.queries.join(" | "), sources: candidates }
            });
            const verdicts = new Map((reviewed.result.selected || []).map((item) => [Number(item.index), item]));
            selected = candidates.flatMap((source, sourceIndex) => {
              const verdict = verdicts.get(sourceIndex);
              return verdict ? [{ ...source, aiRelation: verdict.relation, aiReason: verdict.reason }] : [];
            });
            answer = clean(reviewed.result.answer) || answer;
          } catch (reviewError) {
            answer = `正文筛选已完成；AI 复核失败，保留正文命中结果：${reviewError.message}`;
          }
        }

        const tagged = selected.map((source) => ({ ...source, atomicClaimId: atomic.id, atomicClaim: atomic.text }));
        accepted.push(...tagged);
        trace.push({
          id: atomic.id,
          claim: atomic.text,
          queries: atomic.queries,
          candidateCount: candidates.length,
          acceptedCount: tagged.length,
          answer,
          error
        });
      }

      await onProgress({ percent: 86, label: "正在合并证据", detail: "去除重复网页，区分支持、反驳和证据不足" });
      const seen = new Set();
      const sources = accepted.filter((source) => {
        const key = `${source.atomicClaimId}:${source.url}`;
        if (!source.url || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const supported = sources.filter((item) => item.aiRelation === "supports").length;
      const refuted = sources.filter((item) => item.aiRelation === "refutes").length;
      const unresolved = trace.filter((item) => item.acceptedCount === 0).length;
      const undecided = sources.length - supported - refuted;
      const answer = configuredAI
        ? `共核验 ${trace.length} 个独立事实：${supported} 条支持证据，${refuted} 条反驳证据，${undecided} 条正文相关证据待人工判断，${unresolved} 个事实证据不足。`
        : `共核验 ${trace.length} 个独立事实，找到 ${sources.length} 个正文相关来源；配置 AI 后可继续判断支持或反驳。`;
      await onProgress({ percent: 100, label: "研究式搜索完成", detail: answer });
      return { sources, answer, plan, trace };
    }
  };
}

import dns from "node:dns/promises";
import net from "node:net";

const MAX_PAGE_BYTES = 2_000_000;

function stripMarkup(value = "") {
  return decodeEntities(String(value).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function resultUrl(value = "") {
  try {
    const parsed = new URL(value.startsWith("//") ? `https:${value}` : value);
    const target = parsed.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : parsed.href;
  } catch { return ""; }
}

async function duckSearch(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 YanjiEvidenceSearch/1.0", "Accept": "text/html" }
    });
    if (!response.ok) return [];
    const html = await response.text();
    const results = [];
    const pattern = /<a\b[^>]*class=["']result__a["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]{0,1800}?<a\b[^>]*class=["']result__snippet["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of html.matchAll(pattern)) {
      const url = resultUrl(decodeEntities(match[1]));
      if (!url || !/^https?:\/\//i.test(url)) continue;
      results.push({ title: stripMarkup(match[2]), url, excerpt: stripMarkup(match[3]) });
      if (results.length >= 6) break;
    }
    return results;
  } catch { return []; }
  finally { clearTimeout(timer); }
}

async function resolveSogouLink(value) {
  try {
    const url = new URL(value, "https://www.sogou.com");
    if (url.hostname !== "www.sogou.com" || url.pathname !== "/link") return url.href;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 YanjiEvidenceSearch/1.0", "Referer": "https://www.sogou.com/" }
    });
    const html = (await response.text()).slice(0, 5000);
    const encoded = html.match(/window\.location\.replace\(["']([^"']+)["']\)/i)?.[1]
      || html.match(/URL=['"]?([^'";>]+)/i)?.[1];
    return encoded ? decodeEntities(encoded.replace(/\\\//g, "/")) : "";
  } catch { return ""; }
}

async function sogouSearch(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://www.sogou.com/web?query=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 YanjiEvidenceSearch/1.0", "Accept": "text/html" }
    });
    if (!response.ok) return [];
    const html = await response.text();
    const raw = [];
    const titlePattern = /<h3\b[^>]*class=["'][^"']*vr-title[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi;
    for (const match of html.matchAll(titlePattern)) {
      const tail = html.slice(match.index + match[0].length, match.index + match[0].length + 1800);
      const summary = tail.match(/<(?:div|p)\b[^>]*class=["'][^"']*(?:space-txt|text-layout|str-text-info)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p)>/i)?.[1] || "";
      raw.push({ href: decodeEntities(match[1]), title: stripMarkup(match[2]), excerpt: stripMarkup(summary) });
      if (raw.length >= 8) break;
    }
    return Promise.all(raw.map(async (item) => ({ ...item, url: await resolveSogouLink(item.href) })));
  } catch { return []; }
  finally { clearTimeout(timer); }
}

function decodeBingUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== "www.bing.com" || parsed.pathname !== "/ck/a") return value;
    const encoded = parsed.searchParams.get("u");
    if (!encoded || !encoded.startsWith("a1")) return value;
    const decoded = Buffer.from(encoded.slice(2), "base64").toString("utf8");
    return decoded.startsWith("http") ? decoded : value;
  } catch { return value; }
}

async function bingSearch(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-CN&ensearch=0`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9"
      }
    });
    if (!response.ok) return [];
    const html = await response.text();
    const results = [];
    const algoPattern = /<li\b[^>]*class=["'][^"']*b_algo[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    for (const match of html.matchAll(algoPattern)) {
      const block = match[1];
      const titleMatch = block.match(/<h2[^>]*><a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a><\/h2>/i);
      if (!titleMatch) continue;
      const url = decodeBingUrl(decodeEntities(titleMatch[1]));
      if (!url || !/^https?:\/\//i.test(url)) continue;
      const title = stripMarkup(titleMatch[2]);
      const afterTitle = block.slice(titleMatch.index + titleMatch[0].length);
      const snippetMatch = afterTitle.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)
        || afterTitle.match(/<div\b[^>]*class=["'][^"']*(?:b_caption|b_lineclamp)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      const excerpt = snippetMatch ? stripMarkup(snippetMatch[1]) : "";
      results.push({ title, url, excerpt });
      if (results.length >= 8) break;
    }
    return results;
  } catch { return []; }
  finally { clearTimeout(timer); }
}

async function serperSearch(query, apiKey) {
  if (!apiKey) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      signal: controller.signal,
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl: "cn", hl: "zh-cn", num: 10 })
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data.organic)) return [];
    return data.organic.slice(0, 8).map((item) => ({
      title: item.title || "",
      url: item.link || "",
      excerpt: item.snippet || ""
    })).filter((item) => /^https?:\/\//i.test(item.url));
  } catch { return []; }
  finally { clearTimeout(timer); }
}

export function evidenceQuery(value) {
  const compact = String(value || "").replace(/\s+/g, " ").trim();
  // 领域核心词：原文直接出现则优先提取
  const domainPhrases = [
    "爱新觉罗", "钮祜禄", "叶赫那拉", "瓜尔佳", "八旗制度", "上三旗", "下五旗", "正黄旗", "镶黄旗", "正白旗",
    "八旗", "努尔哈赤", "皇太极", "多尔衮", "清军入关", "跑马圈地", "四九城", "盟旗制度", "扎萨克",
    "辛亥革命", "驱除鞑虏", "恢复中华", "慈禧", "鳌拜", "达拉特旗", "伊金霍洛旗", "翁牛特旗",
    "满语", "汉姓", "满洲", "旗人", "蒙古", "清朝", "民国", "故宫", "紫禁城"
  ].filter((phrase) => compact.includes(phrase));
  // 推断规则：从具体表述推断出更通用的检索词
  const inferred = [];
  if (/正黄[、,]?镶黄[、,]?正白|上三旗/.test(compact)) inferred.push("上三旗");
  if (/下五旗|五旗由王爷|剩下五旗/.test(compact)) inferred.push("下五旗");
  if (/正黄|镶黄|正白|正红|镶红|正蓝|镶蓝/.test(compact) && !domainPhrases.includes("八旗")) inferred.push("八旗");
  if (/改姓|汉姓|改成.*姓/.test(compact)) inferred.push("满族改姓");
  if (/狼.*意思|满语.*意思/.test(compact)) inferred.push("满语词义");
  // 停用词：虚词、形容词、副词、通用动词
  const stopWords = new Set([
    "所以", "那么", "至于", "还有", "而且", "我们", "现在", "这个", "这些", "这一", "一条", "一层", "一种",
    "就是", "属于", "时候", "里面", "剩下", "说法", "方向", "正确", "通行", "表述", "已经", "比较", "主要",
    "可以", "保留", "建议", "原句", "严格", "意思", "讲的是", "公开", "大多", "后来", "全文", "事实", "此处",
    "亲自", "地位", "最高", "的是", "常见", "准确", "统领", "一支", "一直", "一样", "一片", "一些", "一下",
    "因为", "所以", "但是", "如果", "虽然", "不过", "然后", "于是", "因此", "其实", "当然", "毕竟", "简直",
    "非常", "十分", "特别", "比较", "相当", "更加", "越来越", "最", "更", "太", "真", "好", "多", "少",
    "他们", "她们", "它们", "自己", "大家", "别人", "人家", "什么", "怎么", "怎样", "为什么", "哪", "哪里",
    "出来", "出去", "上来", "上去", "下来", "下去", "起来", "过来", "过去", "回来", "回去", "开来", "开去",
    "做了", "干了", "说了", "看了", "听了", "想了", "知道", "觉得", "认为", "发现", "感到", "看到", "听到",
    "开始", "结束", "继续", "停止", "进行", "通过", "经过", "根据", "按照", "为了", "对于", "关于", "由于",
    "这里", "那里", "哪里", "这边", "那边", "旁边", "中间", "里面", "外面", "上面", "下面", "前面", "后面",
    "今天", "明天", "昨天", "现在", "以前", "以后", "后来", "当时", "时候", "时间", "年代", "时期", "阶段",
    "一个", "两个", "三个", "几个", "很多", "许多", "大量", "少量", "部分", "全部", "所有", "整个", "整体",
    "不是", "不会", "不能", "不要", "不用", "没有", "没", "不", "是", "了", "的", "和", "与", "及", "或",
    "在", "有", "为", "上", "下", "中", "里", "外", "前", "后", "左", "右", "大", "小", "长", "短", "高", "低",
    "好", "坏", "新", "旧", "老", "少", "快", "慢", "早", "晚", "远", "近", "热", "冷", "甜", "苦", "酸", "辣",
    "红", "黄", "蓝", "绿", "白", "黑", "紫", "灰", "粉", "橙", "棕", "金", "银", "铁", "铜", "锡", "铅",
    "第一", "第二", "第三", "首先", "其次", "最后", "最终", "终于", "到底", "究竟", "毕竟", "简直", "几乎",
    "可能", "也许", "大概", "大约", "差不多", "几乎", "将近", "超过", "不足", "不到", "不止", "不只", "不仅",
    "需要", "应该", "必须", "能够", "可以", "可能", "愿意", "敢", "肯", "要", "想", "希望", "期望", "打算",
    "说", "讲", "谈", "聊", "问", "答", "叫", "喊", "唱", "读", "写", "看", "听", "想", "做", "干", "搞",
    "走", "跑", "跳", "飞", "游", "爬", "坐", "站", "躺", "睡", "醒", "吃", "喝", "穿", "戴", "拿", "放",
    "给", "送", "借", "还", "买", "卖", "换", "找", "丢", "捡", "拾", "搬", "运", "带", "拿", "取", "存",
    "打", "击", "敲", "撞", "碰", "摸", "抱", "搂", "握", "抓", "捏", "掐", "拍", "打", "踢", "踩", "踏",
    "来", "去", "进", "出", "回", "到", "过", "起", "下", "上", "开", "关", "停", "动", "转", "流", "漂",
    "是", "有", "在", "了", "的", "和", "与", "及", "或", "等", "等等", "之类", "什么的", "等等的", "什么的",
    "把", "被", "让", "给", "为", "替", "对", "向", "往", "从", "由", "自", "于", "以", "用", "靠", "凭",
    "按照", "根据", "通过", "经过", "由于", "因为", "为了", "对于", "关于", "至于", "由于", "鉴于", "基于",
    "如果", "假如", "假设", "要是", "倘若", "万一", "只要", "只有", "除非", "除了", "除去", "除开", "除却",
    "虽然", "尽管", "固然", "但是", "可是", "然而", "不过", "只是", "就是", "反而", "反倒", "相反", "反之",
    "因为", "所以", "因此", "因而", "于是", "从而", "以致", "以至", "可见", "看来", "想来", "看来", "听说",
    "不但", "不仅", "不光", "不单", "不只", "而且", "并且", "况且", "何况", "甚至", "乃至", "以至", "甚至于",
    "或者", "或是", "还是", "要么", "与其", "不如", "宁可", "宁愿", "宁肯", "也不", "也要", "也得", "也该",
    "的话", "的话", "来说", "而言", "来看", "来讲", "说来", "讲来", "算来", "看来", "想来", "听来", "闻来",
    "一下", "一下子", "一刻", "一会儿", "一阵子", "一场", "一番", "一度", "一再", "再三", "屡次", "屡屡", "频频",
    "已经", "曾经", "刚刚", "刚才", "正在", "将要", "即将", "快要", "就要", "快要", "将近", "几乎", "差不多",
    "本来", "原来", "其实", "事实上", "实际上", "说白了", "坦白说", "老实说", "说真的", "说实话", "说句实话",
    "当然", "自然", "显然", "明显", "分明", "明明", "明明是", "分明是", "显然是", "当然是", "自然是", "一定是",
    "也许", "或许", "大概", "大约", "差不多", "几乎", "将近", "估计", "预计", "预期", "预料", "意料", "料到",
    "必须", "一定", "必定", "必然", "务必", "务须", "须要", "需要", "应该", "应当", "应", "该", "当", "得",
    "可以", "可", "能", "能够", "会", "要", "想", "愿意", "乐意", "肯", "敢", "勇于", "敢于", "善于", "擅长",
    "不要", "别", "莫", "勿", "休", "不可", "不能", "不许", "不准", "禁止", "防止", "避免", "以免", "以防",
    "我们", "咱们", "你", "你们", "他", "他们", "她", "她们", "它", "它们", "自己", "自家", "自身", "本身",
    "大家", "大伙", "众人", "别人", "人家", "旁人", "他人", "他者", "异己", "外人", "外边", "外面", "外头",
    "这", "那", "哪", "这个", "那个", "哪个", "这些", "那些", "哪些", "这儿", "那儿", "哪儿", "这里", "那里", "哪里",
    "这么", "那么", "怎么", "怎样", "怎么样", "怎么办", "为什么", "为何", "为啥", "何以", "凭什么", "靠什么", "用什么",
    "多", "少", "大", "小", "长", "短", "高", "低", "宽", "窄", "厚", "薄", "深", "浅", "重", "轻", "快", "慢",
    "好", "坏", "美", "丑", "善", "恶", "真", "假", "对", "错", "是", "非", "正", "反", "公", "私", "明", "暗",
    "新", "旧", "老", "少", "幼", "长", "强", "弱", "软", "硬", "冷", "热", "温", "凉", "干", "湿", "燥", "润",
    "甜", "苦", "酸", "辣", "咸", "淡", "香", "臭", "腥", "膻", "腻", "鲜", "美", "味", "道", "滋", "养",
    "红", "黄", "蓝", "绿", "白", "黑", "紫", "灰", "粉", "橙", "棕", "金", "银", "彩", "素", "艳", "雅", "俗",
    "上", "下", "左", "右", "前", "后", "里", "外", "中", "内", "旁", "侧", "边", "角", "端", "顶", "底", "根",
    "东", "南", "西", "北", "中", "央", "首", "末", "始", "终", "头", "尾", "尖", "根", "基", "础", "本", "源",
    "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "百", "千", "万", "亿", "零", "半", "双", "单", "匹",
    "个", "只", "条", "件", "项", "种", "类", "样", "批", "群", "队", "组", "套", "双", "对", "副", "串", "堆",
    "次", "回", "遍", "趟", "场", "阵", "顿", "番", "下", "把", "儿", "子", "头", "者", "员", "人", "家", "户",
    "元", "角", "分", "斤", "两", "钱", "寸", "尺", "丈", "里", "亩", "顷", "升", "斗", "石", "方", "平方", "立方",
    "年", "月", "日", "时", "分", "秒", "刻", "周", "旬", "季", "载", "岁", "秋", "春", "夏", "冬", "晨", "昏",
    "今天", "明天", "昨天", "前天", "后天", "今日", "明日", "昨日", "前日", "后日", "今晚", "明晚", "昨晚", "前夜",
    "现在", "以前", "以后", "之前", "之后", "当时", "那时", "这时", "将来", "未来", "过去", "从前", "以前", "以往",
    "时候", "时间", "时刻", "时分", "时节", "时期", "时代", "年代", "年度", "月份", "日期", "日子", "时光", "光阴",
    "地方", "地点", "地址", "位置", "方位", "方向", "区域", "地区", "地带", "地域", "领土", "国土", "疆域", "版图",
    "东西", "南北", "上下", "左右", "前后", "里外", "内外", "中间", "中央", "中心", "核心", "重心", "重点", "焦点",
    "问题", "答案", "结果", "结论", "原因", "理由", "道理", "原理", "规律", "规则", "规矩", "制度", "体制", "体系",
    "方法", "办法", "措施", "手段", "途径", "路径", "方式", "形式", "模式", "模型", "样式", "款式", "格式", "式子",
    "内容", "形式", "本质", "现象", "表面", "实质", "核心", "关键", "重点", "要点", "难点", "疑点", "焦点", "热点",
    "情况", "状况", "状态", "情形", "情景", "景象", "场面", "场景", "画面", "镜头", "背景", "前景", "情景", "情境",
    "关系", "联系", "关联", "相关", "相干", "攸关", "涉及", "牵扯", "牵涉", "关联", "关系", "联系", "往来", "交往",
    "作用", "影响", "效果", "结果", "后果", "成果", "效果", "效应", "反应", "反映", "反馈", "回应", "响应", "反应",
    "变化", "变动", "变迁", "变革", "演变", "演化", "发展", "进展", "进步", "提高", "提升", "改善", "改进", "改变",
    "增加", "减少", "增强", "减弱", "加强", "削弱", "扩大", "缩小", "延伸", "压缩", "扩展", "紧缩", "放宽", "收紧",
    "开始", "结束", "停止", "继续", "持续", "延续", "维持", "保持", "坚持", "坚守", "守护", "保护", "维护", "护卫",
    "进行", "开展", "展开", "举行", "举办", "办理", "处理", "处置", "解决", "处理", "整理", "梳理", "整顿", "整治",
    "需要", "需求", "要求", "请求", "恳求", "哀求", "乞求", "祈求", "诉求", "主张", "倡议", "提倡", "倡导", "呼吁",
    "重要", "主要", "关键", "核心", "首要", "头等", "第一", "首位", "首席", "主角", "主力", "主干", "主导", "主管",
    "一般", "普通", "平常", "通常", "正常", "常规", "常见", "普遍", "广泛", "大众", "群众", "公众", "社会", "民间",
    "特殊", "特别", "特定", "特色", "特点", "特征", "特性", "特质", "特长", "专长", "专门", "专业", "专科", "专题",
    "简单", "容易", "轻易", "方便", "便利", "快捷", "快速", "迅速", "敏捷", "灵敏", "灵活", "灵巧", "轻便", "轻巧",
    "复杂", "困难", "艰难", "艰苦", "辛苦", "辛劳", "辛勤", "勤恳", "勤奋", "努力", "刻苦", "用心", "专心", "细心",
    "清楚", "清晰", "明白", "明确", "明显", "显著", "突出", "特别", "特殊", "特定", "具体", "详细", "详尽", "细致",
    "模糊", "含糊", "朦胧", "隐约", "大概", "大约", "大致", "大体", "基本", "根本", "完全", "全部", "整个", "整体",
    "部分", "局部", "方面", "层面", "层次", "级别", "等级", "等次", "档次", "品位", "品质", "质量", "质地", "质感",
    "可能", "可以", "能够", "会", "要", "想", "愿意", "乐意", "肯", "敢", "勇于", "敢于", "善于", "擅长", "精通",
    "应该", "应当", "应", "该", "当", "得", "须", "必须", "务必", "一定", "必定", "必然", "铁定", "准定", "定准",
    "不要", "别", "莫", "勿", "休", "不可", "不能", "不许", "不准", "禁止", "防止", "避免", "以免", "以防", "免得",
    "我们", "咱们", "你", "你们", "他", "他们", "她", "她们", "它", "它们", "自己", "自家", "自身", "本身", "亲自",
    "大家", "大伙", "众人", "别人", "人家", "旁人", "他人", "他者", "异己", "外人", "外边", "外面", "外头", "外观",
    "这", "那", "哪", "这个", "那个", "哪个", "这些", "那些", "哪些", "这儿", "那儿", "哪儿", "这里", "那里", "哪里",
    "这么", "那么", "怎么", "怎样", "怎么样", "怎么办", "为什么", "为何", "为啥", "何以", "凭什么", "靠什么", "用什么",
    "多", "少", "大", "小", "长", "短", "高", "低", "宽", "窄", "厚", "薄", "深", "浅", "重", "轻", "快", "慢",
    "好", "坏", "美", "丑", "善", "恶", "真", "假", "对", "错", "是", "非", "正", "反", "公", "私", "明", "暗",
    "新", "旧", "老", "少", "幼", "长", "强", "弱", "软", "硬", "冷", "热", "温", "凉", "干", "湿", "燥", "润",
    "甜", "苦", "酸", "辣", "咸", "淡", "香", "臭", "腥", "膻", "腻", "鲜", "美", "味", "道", "滋", "养",
    "红", "黄", "蓝", "绿", "白", "黑", "紫", "灰", "粉", "橙", "棕", "金", "银", "彩", "素", "艳", "雅", "俗",
    "上", "下", "左", "右", "前", "后", "里", "外", "中", "内", "旁", "侧", "边", "角", "端", "顶", "底", "根",
    "东", "南", "西", "北", "中", "央", "首", "末", "始", "终", "头", "尾", "尖", "根", "基", "础", "本", "源",
    "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "百", "千", "万", "亿", "零", "半", "双", "单", "匹",
    "个", "只", "条", "件", "项", "种", "类", "样", "批", "群", "队", "组", "套", "双", "对", "副", "串", "堆",
    "次", "回", "遍", "趟", "场", "阵", "顿", "番", "下", "把", "儿", "子", "头", "者", "员", "人", "家", "户",
    "元", "角", "分", "斤", "两", "钱", "寸", "尺", "丈", "里", "亩", "顷", "升", "斗", "石", "方", "平方", "立方",
    "年", "月", "日", "时", "分", "秒", "刻", "周", "旬", "季", "载", "岁", "秋", "春", "夏", "冬", "晨", "昏",
    "今天", "明天", "昨天", "前天", "后天", "今日", "明日", "昨日", "前日", "后日", "今晚", "明晚", "昨晚", "前夜",
    "现在", "以前", "以后", "之前", "之后", "当时", "那时", "这时", "将来", "未来", "过去", "从前", "以前", "以往",
    "时候", "时间", "时刻", "时分", "时节", "时期", "时代", "年代", "年度", "月份", "日期", "日子", "时光", "光阴",
    "地方", "地点", "地址", "位置", "方位", "方向", "区域", "地区", "地带", "地域", "领土", "国土", "疆域", "版图",
    "东西", "南北", "上下", "左右", "前后", "里外", "内外", "中间", "中央", "中心", "核心", "重心", "重点", "焦点",
    "问题", "答案", "结果", "结论", "原因", "理由", "道理", "原理", "规律", "规则", "规矩", "制度", "体制", "体系",
    "方法", "办法", "措施", "手段", "途径", "路径", "方式", "形式", "模式", "模型", "样式", "款式", "格式", "式子",
    "内容", "形式", "本质", "现象", "表面", "实质", "核心", "关键", "重点", "要点", "难点", "疑点", "焦点", "热点",
    "情况", "状况", "状态", "情形", "情景", "景象", "场面", "场景", "画面", "镜头", "背景", "前景", "情景", "情境",
    "关系", "联系", "关联", "相关", "相干", "攸关", "涉及", "牵扯", "牵涉", "关联", "关系", "联系", "往来", "交往",
    "作用", "影响", "效果", "结果", "后果", "成果", "效果", "效应", "反应", "反映", "反馈", "回应", "响应", "反应",
    "变化", "变动", "变迁", "变革", "演变", "演化", "发展", "进展", "进步", "提高", "提升", "改善", "改进", "改变",
    "增加", "减少", "增强", "减弱", "加强", "削弱", "扩大", "缩小", "延伸", "压缩", "扩展", "紧缩", "放宽", "收紧",
    "开始", "结束", "停止", "继续", "持续", "延续", "维持", "保持", "坚持", "坚守", "守护", "保护", "维护", "护卫",
    "进行", "开展", "展开", "举行", "举办", "办理", "处理", "处置", "解决", "处理", "整理", "梳理", "整顿", "整治",
    "需要", "需求", "要求", "请求", "恳求", "哀求", "乞求", "祈求", "诉求", "主张", "倡议", "提倡", "倡导", "呼吁",
    "重要", "主要", "关键", "核心", "首要", "头等", "第一", "首位", "首席", "主角", "主力", "主干", "主导", "主管",
    "一般", "普通", "平常", "通常", "正常", "常规", "常见", "普遍", "广泛", "大众", "群众", "公众", "社会", "民间",
    "特殊", "特别", "特定", "特色", "特点", "特征", "特性", "特质", "特长", "专长", "专门", "专业", "专科", "专题",
    "简单", "容易", "轻易", "方便", "便利", "快捷", "快速", "迅速", "敏捷", "灵敏", "灵活", "灵巧", "轻便", "轻巧",
    "复杂", "困难", "艰难", "艰苦", "辛苦", "辛劳", "辛勤", "勤恳", "勤奋", "努力", "刻苦", "用心", "专心", "细心",
    "清楚", "清晰", "明白", "明确", "明显", "显著", "突出", "特别", "特殊", "特定", "具体", "详细", "详尽", "细致",
    "模糊", "含糊", "朦胧", "隐约", "大概", "大约", "大致", "大体", "基本", "根本", "完全", "全部", "整个", "整体",
    "部分", "局部", "方面", "层面", "层次", "级别", "等级", "等次", "档次", "品位", "品质", "质量", "质地", "质感"
  ]);
  const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
  const words = [...segmenter.segment(compact)]
    .filter((part) => part.isWordLike)
    .map((part) => part.segment.trim())
    .filter((word) => word.length >= 2 && !stopWords.has(word) && !/^\d+$/u.test(word))
    .sort((a, b) => b.length - a.length);
  // 合并：领域词 + 推断词 + 长词优先，去重，取前5个
  const merged = [...new Set([...domainPhrases, ...inferred, ...words])]
    .filter((word) => word.length >= 2)
    .slice(0, 5);
  return merged.join(" ").slice(0, 60);
}

const SEARCH_THROTTLE_MS = 900;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MIN_RELEVANCE_SCORE = 5;

function scoreSource(item, terms, peopleTerms) {
  const title = (item.title || "").replace(/\s+/g, "");
  const excerpt = (item.excerpt || "").replace(/\s+/g, "");
  let score = 0;
  let titleHits = 0;
  let excerptHits = 0;
  for (const term of terms) {
    const inTitle = title.includes(term);
    const inExcerpt = excerpt.includes(term);
    if (inTitle) { score += term.length >= 4 ? 5 : 3; titleHits += 1; }
    if (inExcerpt) { score += term.length >= 4 ? 2 : 1; excerptHits += 1; }
  }
  // 标题必须至少匹配一个关键词，否则视为不相关（防止只靠域名蹭进来）
  if (titleHits === 0) return 0;
  if (peopleTerms.length >= 2) {
    const evidence = title + excerpt;
    const peopleHits = peopleTerms.filter((name) => evidence.includes(name)).length;
    if (peopleHits === 0) return 0;
    score += peopleHits * 2;
  }
  if (titleHits >= 2) score += 3;
  if (titleHits >= 1 && excerptHits >= 1) score += 2;
  // 域名可信度加分（仅权威来源，百科类参考来源不加分）
  try {
    const host = new URL(item.url).hostname.toLowerCase();
    if (host.endsWith(".gov.cn")) score += 2;
    if (host.includes("dpm.org.cn") || host.includes("museum")) score += 1;
    if (host.endsWith(".edu.cn")) score += 1;
  } catch { /* ignore */ }
  return score;
}

async function searchOneText(text, serperKey, fallbackKind) {
  const found = [];
  // 第一优先：Serper API（稳定的Google搜索结果）
  if (serperKey) {
    found.push(...await serperSearch(text, serperKey));
  }
  // Fallback：公开搜索引擎HTML抓取（免费但不稳定）
  const needFallback = !serperKey || found.length < 4;
  if (needFallback) {
    // 多查询时每个查询轮换不同的fallback引擎，避免总时长过长
    const engineSets = serperKey
      ? [[() => bingSearch(text)]]
      : [
          [() => bingSearch(text), () => duckSearch(`${text} site:gov.cn`)],
          [() => sogouSearch(`${text} 政府 高校`), () => bingSearch(text)],
          [() => sogouSearch(`${text} 故宫博物院`), () => duckSearch(text)]
        ];
    const tasks = engineSets[fallbackKind % engineSets.length];
    for (let i = 0; i < tasks.length; i += 1) {
      try {
        found.push(...await tasks[i]());
      } catch { /* 单个搜索引擎失败不影响整体 */ }
      if (i < tasks.length - 1) await sleep(SEARCH_THROTTLE_MS);
    }
  }
  return found;
}

export async function searchWebSources(query, options = {}) {
  // 像带联网检索的研究助手一样：保留原问法，同时用实体化问法交叉检索。
  // 单一口语句往往会带来同名、营销页或断章结果，不能只靠一次关键词匹配。
  const rawList = Array.isArray(query)
    ? query.filter(Boolean)
    : [query, ...(Array.isArray(options.queries) ? options.queries.filter(Boolean) : [])].filter(Boolean);
  if (!rawList.length) return [];

  const textList = [...new Set(rawList.flatMap((q) => {
    const original = String(q).replace(/\s+/gu, " ").trim();
    const focused = evidenceQuery(original);
    return [original, focused, focused ? `${focused} 资料` : ""];
  }).filter(Boolean))].slice(0, 6);
  if (!textList.length) return [];
  const primaryText = textList[0];
  const serperKey = options.serperApiKey || options.searchApiKey || process.env.SERPER_API_KEY || "";

  const all = [];
  for (let i = 0; i < textList.length; i += 1) {
    const results = await searchOneText(textList[i], serperKey, i);
    all.push(...results.map((item) => ({ ...item, searchText: textList[i] })));
    if (i < textList.length - 1) await sleep(serperKey ? 300 : SEARCH_THROTTLE_MS);
  }

  const seen = new Set();
  const trusted = [];
  for (const item of all) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    try {
      const host = new URL(item.url).hostname.toLowerCase();
      const isAuthority = host.endsWith(".gov.cn") || host.endsWith(".edu.cn") || /museum|dpm\.org\.cn|cssn\.cn|people\.com\.cn|xinhuanet\.com|gmw\.cn|china\.com\.cn|chinadaily\.com\.cn/.test(host);
      const isReference = /baike\.baidu\.com|zh\.wikipedia\.org|baike\.com/.test(host);
      // Serper模式下放宽来源限制，保留所有结果但标注类型；HTML模式下只保留可信来源
      if (!serperKey && !isAuthority && !isReference) continue;
      const terms = [...new Set(String(item.searchText || primaryText).split(/\s+/u).filter(Boolean))];
      const peopleTerms = ["吴京", "那英", "郎朗", "郎平", "关晓彤", "关之琳", "金巧巧"].filter((name) => terms.includes(name));
      const score = scoreSource(item, terms, peopleTerms);
      // Serper模式下，如果标题完全没匹配但来源是权威网站，给一个基础分
      let finalScore = score;
      if (serperKey && score === 0 && (isAuthority || isReference)) finalScore = 3;
      if (finalScore < MIN_RELEVANCE_SCORE && !serperKey) continue;
      const { searchText, ...source } = item;
      trusted.push({
        ...source,
        relevanceScore: finalScore,
        sourceType: isAuthority ? "authority" : isReference ? "reference" : "general",
        matchedQuery: searchText
      });
    } catch { /* ignore invalid items */ }
  }
  trusted.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const candidates = trusted.slice(0, 6);
  const verified = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    try {
      const preview = await fetchSourcePreview({ url: candidate.url, query: candidate.matchedQuery || primaryText, excerpt: candidate.excerpt || "" });
      if (preview?.matched && preview.highlight) {
        candidate.evidence = {
          title: preview.title,
          url: preview.url,
          before: preview.before || "",
          highlight: preview.highlight,
          after: preview.after || "",
          matched: true,
          cachedAt: new Date().toISOString()
        };
        candidate.relevanceScore += 6;
      }
    } catch { /* 证据缓存失败不影响搜索结果 */ }
    verified.push(candidate);
    if (i < candidates.length - 1) await sleep(350);
  }
  // 只返回正文中确实覆盖多个检索要点的来源。宁可返回空，也不拿标题相关冒充证据。
  verified.sort((a, b) => Number(Boolean(b.evidence?.matched)) - Number(Boolean(a.evidence?.matched)) || b.relevanceScore - a.relevanceScore);
  return verified.filter((item) => item.evidence?.matched).slice(0, 3);
}

function isPrivateAddress(address) {
  const value = String(address || "").toLowerCase();
  if (value === "::1" || value === "::" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped || (net.isIP(value) === 4 ? value : "");
  if (!ipv4) return false;
  const [a, b] = ipv4.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168);
}

async function validateUrl(value) {
  let parsed;
  try { parsed = new URL(value); }
  catch { throw Object.assign(new Error("来源链接格式不正确"), { statusCode: 400 }); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw Object.assign(new Error("只支持网页链接"), { statusCode: 400 });
  if (parsed.username || parsed.password) throw Object.assign(new Error("来源链接不能包含账号信息"), { statusCode: 400 });
  const records = net.isIP(parsed.hostname)
    ? [{ address: parsed.hostname }]
    : await dns.lookup(parsed.hostname, { all: true }).catch(() => []);
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
    throw Object.assign(new Error("无法预览这个地址"), { statusCode: 400 });
  }
  return parsed;
}

function decodeEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
    }
    return named[entity.toLowerCase()] || " ";
  });
}

function pageText(html) {
  const cleaned = String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const mainMatch = cleaned.match(/<(article|main|div)\b[^>]*(?:id|class)=["'][^"']*(?:content_with_keyword|article-content|article_body|article-body|entry-content|post-content|TRS_Editor)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i);
  if (mainMatch) {
    const mainText = decodeEntities(mainMatch[2].replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, " "))
      .replace(/[ \t\r\f\v]+/g, " ").replace(/\n\s+/g, "\n").trim();
    if (mainText.length >= 120) return mainText;
  }
  const blocks = [...cleaned.matchAll(/<(p|h[1-6]|blockquote|td|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => decodeEntities(match[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((text) => text.length >= 16)
    .filter((text) => {
      const navWords = ["首页", "导航", "登录", "注册", "开放时间", "在线订票", "网站地图", "English"];
      const hits = navWords.filter((word) => text.includes(word)).length;
      return hits < 3 || /[。！？]/u.test(text);
    });
  const unique = [...new Set(blocks)];
  if (unique.join(" ").length >= 180) return unique.join("\n");
  return decodeEntities(cleaned.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function locate(text, query, excerpt) {
  const queryTerms = [...new Set(String(query || "").split(/[，。！？；：、,.!?;:\s]+/u).map((term) => term.trim()).filter((term) => term.length >= 2))];
  const requiredTermHits = Math.min(2, queryTerms.length);
  const hints = [excerpt]
    .map((item) => String(item || "").trim())
    .filter((item) => item.length >= 12 && queryTerms.filter((term) => item.includes(term)).length >= requiredTermHits)
    .sort((a, b) => b.length - a.length);
  for (const hint of hints) {
    let needle = hint;
    let index = text.indexOf(needle);
    if (index < 0 && needle.length > 18) {
      needle = needle.slice(0, 18);
      index = text.indexOf(needle);
    }
    if (index >= 0) {
      const nearbyStart = Math.max(0, index - 280);
      const paragraphStart = text.lastIndexOf("\n", index - 1);
      const start = paragraphStart >= nearbyStart ? paragraphStart + 1 : nearbyStart;
      const paragraphEnd = text.indexOf("\n", index + needle.length);
      const end = paragraphEnd >= 0 && paragraphEnd <= index + needle.length + 900 ? paragraphEnd : Math.min(text.length, index + needle.length + 620);
      return { before: text.slice(start, index), highlight: text.slice(index, index + needle.length), after: text.slice(index + needle.length, end), matched: true, matchReason: "搜索摘要可在网页正文中定位" };
    }
  }
  const windows = text.split("\n").map((line) => line.trim()).filter((line) => line.length >= 30);
  let bestTermWindow = null;
  for (const line of windows) {
    const hits = queryTerms.filter((term) => line.includes(term));
    if (!bestTermWindow || hits.length > bestTermWindow.hits.length) bestTermWindow = { line, hits };
  }
  if (requiredTermHits && bestTermWindow?.hits.length >= requiredTermHits) {
    return { before: "", highlight: bestTermWindow.line.slice(0, 1200), after: "", matched: true, matchedTerms: bestTermWindow.hits, matchReason: `同一正文片段覆盖 ${bestTermWindow.hits.length} 个关键实体或关系词` };
  }
  const normalizedQuery = String(query || "").replace(/[\s，。！？；：、,.!?;:“”"'（）()《》·—-]/gu, "");
  const grams = [];
  for (const size of [4, 3, 2]) {
    for (let index = 0; index <= normalizedQuery.length - size; index += 1) {
      const gram = normalizedQuery.slice(index, index + size);
      if (text.includes(gram) && !grams.some((item) => item.value === gram)) grams.push({ value: gram, weight: size * size });
    }
  }
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length >= 30);
  let bestLine = null;
  for (const line of lines) {
    const score = grams.filter((gram) => line.includes(gram.value)).reduce((sum, gram) => sum + gram.weight, 0);
    if (!bestLine || score > bestLine.score) bestLine = { line, score };
  }
  if (bestLine?.score >= 8) {
    return { before: "", highlight: bestLine.line.slice(0, 1200), after: "", matched: false, matchReason: "只有局部字词重合，未达到证据门槛" };
  }
  let best = null;
  for (let start = 0; start < text.length; start += 90) {
    const window = text.slice(start, start + 420);
    const score = grams.filter((gram) => window.includes(gram.value)).reduce((sum, gram) => sum + gram.weight, 0);
    if (!best || score > best.score) best = { start, window, score };
  }
  if (best?.score >= 10) {
    return {
      before: text.slice(Math.max(0, best.start - 240), best.start),
      highlight: best.window,
      after: text.slice(best.start + best.window.length, best.start + best.window.length + 320),
      matched: false,
      matchReason: "只有模糊片段重合，未达到证据门槛"
    };
  }
  return { before: text.slice(0, 900), highlight: "", after: "", matched: false, matchReason: "网页正文未覆盖足够的检索要点" };
}

export async function fetchSourcePreview({ url, query = "", excerpt = "" }) {
  let current = await validateUrl(url);
  let response;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 YanjiSourcePreview/1.0", "Accept": "text/html,text/plain;q=0.9" }
      });
    } finally { clearTimeout(timer); }
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location) break;
    current = await validateUrl(new URL(location, current).href);
  }
  if (!response?.ok) throw Object.assign(new Error(`来源页面暂时无法读取（${response?.status || "网络错误"}）`), { statusCode: 502 });
  const type = response.headers.get("content-type") || "";
  if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(type)) throw Object.assign(new Error("这个来源不是可预览的网页正文"), { statusCode: 415 });
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_PAGE_BYTES) throw Object.assign(new Error("来源页面过大，请直接打开原网页"), { statusCode: 413 });
  const raw = (await response.text()).slice(0, MAX_PAGE_BYTES);
  const title = decodeEntities(raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || current.hostname).replace(/\s+/g, " ").trim();
  const text = pageText(raw);
  if (!text) throw Object.assign(new Error("没有提取到可读正文，请直接打开原网页"), { statusCode: 422 });
  return { title, url: current.href, ...locate(text, query, excerpt) };
}

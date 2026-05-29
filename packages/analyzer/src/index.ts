import {
  TECH_TERMS,
  STOP_WORDS,
  clamp,
  countCodeBlocks,
  stableId,
  sumTokenUsage,
  truncate,
  type AILogConversation,
  type AILogMessage,
  type AILogToolCall,
  type AIBehaviorInsight,
  type CollaborationMetrics,
  type ConversationFilters,
  type ConversationCompareResult,
  type OverviewStats,
  type ProjectInsight,
  type PromptInsight,
  type PromptIntent,
  type PromptQualityScore,
  type Provider,
  type SearchQuery,
  type SearchResult,
  type SensitiveFinding,
  type TokenUsage,
  type WordFrequency
} from "@ailog/shared";

const INTENT_RULES: Array<{ intent: PromptIntent; terms: string[] }> = [
  { intent: "bug_fix", terms: ["修复", "报错", "bug", "error", "exception", "stack trace", "失败", "不生效"] },
  { intent: "feature_request", terms: ["实现", "添加", "新增", "feature", "开发", "支持", "做一个", "创建"] },
  { intent: "code_explanation", terms: ["解释", "看不懂", "原理", "为什么", "说明", "explain"] },
  { intent: "refactor", terms: ["重构", "优化结构", "clean code", "抽象", "简化", "整理"] },
  { intent: "test_generation", terms: ["测试", "单测", "test", "vitest", "jest", "playwright", "覆盖率"] },
  { intent: "documentation", terms: ["文档", "readme", "注释", "说明书", "docs"] },
  { intent: "debugging", terms: ["debug", "排查", "定位", "日志", "trace", "复现"] },
  { intent: "architecture_design", terms: ["架构", "设计", "方案", "模块", "系统", "技术选型"] },
  { intent: "code_review", terms: ["review", "代码审查", "检查代码", "找问题", "风险"] },
  { intent: "learning", terms: ["学习", "教程", "入门", "怎么理解", "概念"] },
  { intent: "translation", terms: ["翻译", "translate", "英文", "中文"] },
  { intent: "data_analysis", terms: ["分析数据", "统计", "图表", "csv", "excel", "可视化"] },
  { intent: "devops", terms: ["部署", "docker", "k8s", "ci", "cd", "github actions", "nginx"] },
  { intent: "git_operation", terms: ["git", "commit", "branch", "merge", "rebase", "push", "pull"] }
];

const CJK_RE = /[\u4e00-\u9fff]/;
const ERROR_RE = /(error|exception|traceback|stack trace|failed|报错|异常|失败)/i;
const FILE_RE = /(?:[A-Za-z]:\\|\.{0,2}\/)?[\w.@-]+(?:[\\/][\w.@-]+)+\.[A-Za-z0-9]+/g;
const API_KEY_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/g,
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9_]{20,}/g,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /([?&](?:token|key|secret|access_token)=)[^&\s]+/gi
];
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g;

export function classifyPromptIntent(content: string): PromptIntent {
  const text = content.toLowerCase();
  for (const rule of INTENT_RULES) {
    if (rule.terms.some((term) => text.includes(term.toLowerCase()))) {
      return rule.intent;
    }
  }
  return "other";
}

export function scorePromptQuality(content: string): PromptQualityScore {
  const text = content.trim();
  const lower = text.toLowerCase();
  const length = text.length;
  const missingSignals: string[] = [];

  const hasGoal = /(请|帮我|实现|修复|分析|解释|生成|创建|添加|优化|重构|需要|want|need|please|fix|build|implement)/i.test(text);
  const hasContext = /(背景|上下文|当前|已有|现状|代码|文件|项目|context|given|current|existing)/i.test(text) || FILE_RE.test(text);
  const hasTech = TECH_TERMS.some((term) => lower.includes(term));
  const hasExpectedOutput = /(输出|返回|生成|格式|表格|json|markdown|html|报告|列表|请给出|expected|format)/i.test(text);
  const hasConstraints = /(不要|必须|限制|只能|保持|兼容|本地|隐私|性能|不允许|约束|without|must|only|avoid)/i.test(text);
  const hasExample = /(例如|示例|样例|sample|example|```)/i.test(text);
  const hasError = ERROR_RE.test(text);

  if (!hasGoal) missingSignals.push("明确目标");
  if (!hasContext) missingSignals.push("上下文");
  if (!hasTech) missingSignals.push("技术栈");
  if (!hasExpectedOutput) missingSignals.push("期望输出");
  if (!hasConstraints) missingSignals.push("限制条件");
  if (!hasExample) missingSignals.push("示例");

  const clarity = clamp((hasGoal ? 12 : 3) + (length > 20 ? 5 : 0) + (/[？?。.!]/.test(text) ? 3 : 0), 0, 20);
  const context = clamp((hasContext ? 10 : 0) + (hasTech ? 5 : 0) + (hasError ? 5 : 0), 0, 20);
  const specificity = clamp((FILE_RE.test(text) ? 6 : 0) + (hasExpectedOutput ? 6 : 0) + (length > 80 ? 5 : 0) + (/\d+/.test(text) ? 3 : 0), 0, 20);
  const constraints = clamp((hasConstraints ? 12 : 0) + (/(本地|隐私|性能|兼容|类型|测试|安全|without|avoid)/i.test(text) ? 8 : 0), 0, 20);
  const examples = clamp((hasExample ? 14 : 0) + (countCodeBlocks(text) > 0 ? 6 : 0), 0, 20);
  let total = clarity + context + specificity + constraints + examples;

  if (length < 12) {
    total = Math.max(0, total - 18);
    missingSignals.push("内容过短");
  }
  if (/^(帮我|看一下|优化一下|修一下)[。.!！]*$/.test(text)) {
    total = Math.max(0, total - 22);
    missingSignals.push("描述过于模糊");
  }

  return {
    clarity,
    context,
    specificity,
    constraints,
    examples,
    total: clamp(total, 0, 100),
    missingSignals: Array.from(new Set(missingSignals))
  };
}

export function enrichConversation(conversation: AILogConversation): AILogConversation {
  const messages = conversation.messages.map((message) => {
    if (message.role !== "user") return message;
    const promptIntent = classifyPromptIntent(message.content);
    const promptQuality = scorePromptQuality(message.content);
    return { ...message, promptIntent, promptQuality };
  });

  const tags = new Set(conversation.tags);
  for (const message of messages) {
    if (message.role !== "user") continue;
    if (message.promptIntent && message.promptIntent !== "other") {
      tags.add(intentToTag(message.promptIntent));
    }
    if ((message.promptQuality?.total ?? 0) >= 78) tags.add("high-quality-prompt");
  }
  if (conversation.hasCode) tags.add("code-generation");
  if (conversation.hasShell) tags.add("shell");
  if (conversation.hasMcp) tags.add("mcp");
  if (conversation.hasErrors) tags.add("failed-session");
  if ((conversation.tokenUsage?.totalTokens ?? 0) >= 50000) tags.add("high-token");

  return { ...conversation, messages, tags: Array.from(tags).sort() };
}

export function analyzePrompts(conversations: AILogConversation[]): PromptInsight {
  const prompts = conversations.flatMap((conversation) => conversation.messages.filter((message) => message.role === "user"));
  const lengths = prompts.map((message) => message.content.trim().length).sort((a, b) => a - b);
  const totalLength = lengths.reduce((sum, value) => sum + value, 0);
  const shortestPrompt = prompts.reduce<AILogMessage | undefined>((best, current) => (!best || current.content.length < best.content.length ? current : best), undefined);
  const longestPrompt = prompts.reduce<AILogMessage | undefined>((best, current) => (!best || current.content.length > best.content.length ? current : best), undefined);
  const languageCounts = { zh: 0, en: 0, mixed: 0, other: 0 };
  const intentCounts = emptyIntentCounts();
  const missingSignalCounts: Record<string, number> = {};
  const qualityScores: PromptQualityScore[] = [];

  let questions = 0;
  let imperatives = 0;
  let codeBlocks = 0;
  let filePaths = 0;
  let errorLogs = 0;
  let requirements = 0;
  let keywordHits = 0;

  for (const prompt of prompts) {
    const content = prompt.content;
    languageCounts[detectLanguage(content)] += 1;
    if (/[？?]/.test(content) || /^(how|why|what|where|when|can|could|should)\b/i.test(content.trim())) questions += 1;
    if (/^(请|帮我|实现|修复|添加|优化|重构|生成|create|fix|add|implement|refactor|write)\b/i.test(content.trim())) imperatives += 1;
    if (countCodeBlocks(content) > 0) codeBlocks += 1;
    if (FILE_RE.test(content)) filePaths += 1;
    if (ERROR_RE.test(content)) errorLogs += 1;
    if (/(需求|实现|用户|功能|期望|验收|requirement|acceptance|feature)/i.test(content)) requirements += 1;
    if (/(帮我|优化|修复|解释|实现|重构)/.test(content)) keywordHits += 1;
    const intent = prompt.promptIntent ?? classifyPromptIntent(content);
    intentCounts[intent] += 1;
    const score = prompt.promptQuality ?? scorePromptQuality(content);
    qualityScores.push(score);
    for (const signal of score.missingSignals) {
      missingSignalCounts[signal] = (missingSignalCounts[signal] ?? 0) + 1;
    }
  }

  const topWords = topTerms(prompts.map((prompt) => prompt.content), 50);
  const topPhrases = topNGrams(prompts.map((prompt) => prompt.content), 2, 50);
  const topTechTerms = topKnownTerms(prompts.map((prompt) => prompt.content), TECH_TERMS, 50);
  const topFiles = topFilesFromMessages(prompts, 50);
  const rankedByQuality = [...prompts].sort((a, b) => (b.promptQuality?.total ?? scorePromptQuality(b.content).total) - (a.promptQuality?.total ?? scorePromptQuality(a.content).total));

  return {
    totalPrompts: prompts.length,
    averageLength: prompts.length ? Math.round(totalLength / prompts.length) : 0,
    medianLength: median(lengths),
    shortestPrompt,
    longestPrompt,
    languageRatio: ratioObject(languageCounts, prompts.length),
    questionRatio: ratio(questions, prompts.length),
    imperativeRatio: ratio(imperatives, prompts.length),
    codeBlockRatio: ratio(codeBlocks, prompts.length),
    filePathRatio: ratio(filePaths, prompts.length),
    errorLogRatio: ratio(errorLogs, prompts.length),
    requirementRatio: ratio(requirements, prompts.length),
    keywordRatio: ratio(keywordHits, prompts.length),
    topWords,
    topPhrases,
    topTechTerms,
    topFiles,
    intentCounts,
    qualityAverage: averageQuality(qualityScores),
    highQualityPrompts: rankedByQuality.slice(0, 8),
    lowQualityPrompts: rankedByQuality.slice(-8).reverse(),
    missingSignalCounts
  };
}

export function computeOverviewStats(conversations: AILogConversation[]): OverviewStats {
  const sorted = [...conversations].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const tokenTotals = conversations.map((conversation) => conversation.tokenUsage?.totalTokens ?? 0);
  const totalTokens = tokenTotals.reduce((sum, value) => sum + value, 0);
  const providerCounts = emptyProviderCounts();
  const models = new Map<string, number>();
  const projects = new Map<string, number>();
  const tools = new Map<string, number>();
  const failedTools = new Map<string, number>();
  const daily = new Map<string, { count: number; tokens: number }>();
  const hourly = new Map<number, number>();
  const weekly = new Map<string, { count: number; tokens: number }>();

  let totalMessages = 0;
  let userPrompts = 0;
  let assistantReplies = 0;
  let totalToolCalls = 0;

  for (const conversation of conversations) {
    providerCounts[conversation.provider] += 1;
    totalMessages += conversation.messageCount;
    userPrompts += conversation.userMessageCount;
    assistantReplies += conversation.assistantMessageCount;
    totalToolCalls += conversation.toolCallCount;
    for (const model of conversation.modelNames) increment(models, model);
    if (conversation.projectName) increment(projects, conversation.projectName);
    for (const message of conversation.messages) {
      for (const toolCall of message.toolCalls ?? []) {
        increment(tools, toolCall.name || toolCall.type);
        if (toolCall.status === "error") increment(failedTools, toolCall.name || toolCall.type);
      }
    }
    const date = new Date(conversation.createdAt);
    if (!Number.isNaN(date.getTime())) {
      const dayKey = date.toISOString().slice(0, 10);
      const day = daily.get(dayKey) ?? { count: 0, tokens: 0 };
      day.count += 1;
      day.tokens += conversation.tokenUsage?.totalTokens ?? 0;
      daily.set(dayKey, day);
      hourly.set(date.getHours(), (hourly.get(date.getHours()) ?? 0) + 1);
      const weekKey = getWeekKey(date);
      const week = weekly.get(weekKey) ?? { count: 0, tokens: 0 };
      week.count += 1;
      week.tokens += conversation.tokenUsage?.totalTokens ?? 0;
      weekly.set(weekKey, week);
    }
  }

  const modelCounts = mapToWordFrequency(models);
  const projectCounts = mapToWordFrequency(projects);
  return {
    totalConversations: conversations.length,
    totalMessages,
    userPrompts,
    assistantReplies,
    totalTokens,
    averageTokensPerConversation: conversations.length ? Math.round(totalTokens / conversations.length) : 0,
    totalToolCalls,
    topModel: modelCounts[0]?.term,
    topProject: projectCounts[0]?.term,
    providerCounts,
    modelCounts,
    projectCounts,
    toolCounts: mapToWordFrequency(tools),
    failedToolCounts: mapToWordFrequency(failedTools),
    dailyActivity: Array.from(daily.entries()).map(([date, value]) => ({ date, ...value })).sort((a, b) => a.date.localeCompare(b.date)),
    hourlyActivity: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hourly.get(hour) ?? 0 })),
    weeklyActivity: Array.from(weekly.entries()).map(([week, value]) => ({ week, ...value })).sort((a, b) => a.week.localeCompare(b.week)),
    highCostConversations: [...conversations]
      .sort((a, b) => (b.tokenUsage?.totalTokens ?? 0) - (a.tokenUsage?.totalTokens ?? 0))
      .slice(0, 8)
      .map(compactConversation),
    longConversations: [...conversations].sort((a, b) => b.messageCount - a.messageCount).slice(0, 8).map(compactConversation),
    recentTimeline: sorted.slice(0, 12).map(compactConversation)
  };
}

export function filterConversations(conversations: AILogConversation[], filters: ConversationFilters = {}): AILogConversation[] {
  const keyword = filters.keyword?.toLowerCase().trim();
  let result = conversations.filter((conversation) => {
    if (filters.provider && conversation.provider !== filters.provider) return false;
    if (filters.projectName && conversation.projectName !== filters.projectName) return false;
    if (filters.model && !conversation.modelNames.includes(filters.model)) return false;
    if (filters.tag && !conversation.tags.includes(filters.tag)) return false;
    if (filters.hasToolCalls !== undefined && (conversation.toolCallCount > 0) !== filters.hasToolCalls) return false;
    if (filters.hasErrors !== undefined && Boolean(conversation.hasErrors) !== filters.hasErrors) return false;
    if (filters.hasShell !== undefined && Boolean(conversation.hasShell) !== filters.hasShell) return false;
    if (filters.from && Date.parse(conversation.createdAt) < Date.parse(filters.from)) return false;
    if (filters.to && Date.parse(conversation.createdAt) > Date.parse(filters.to)) return false;
    const tokens = conversation.tokenUsage?.totalTokens ?? 0;
    if (filters.minTokens !== undefined && tokens < filters.minTokens) return false;
    if (filters.maxTokens !== undefined && tokens > filters.maxTokens) return false;
    if (filters.intent && !conversation.messages.some((message) => message.promptIntent === filters.intent)) return false;
    if (keyword) {
      const haystack = [
        conversation.title,
        conversation.summary,
        conversation.projectName,
        conversation.provider,
        conversation.modelNames.join(" "),
        conversation.tags.join(" "),
        conversation.messages.map((message) => message.content).join(" ")
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });

  result = sortConversations(result, filters.sort ?? "newest");
  return result;
}

export function searchConversations(conversations: AILogConversation[], query: SearchQuery): SearchResult[] {
  const q = query.q ?? "";
  if (!q.trim()) return [];
  const flags = query.caseSensitive ? "g" : "gi";
  const matcher = query.regex ? new RegExp(q, flags) : undefined;
  const needle = query.caseSensitive ? q : q.toLowerCase();
  const results: SearchResult[] = [];

  for (const conversation of conversations) {
    if (query.provider && conversation.provider !== query.provider) continue;
    if (query.projectName && conversation.projectName !== query.projectName) continue;
    if (query.from && Date.parse(conversation.createdAt) < Date.parse(query.from)) continue;
    if (query.to && Date.parse(conversation.createdAt) > Date.parse(query.to)) continue;

    const conversationScope = [conversation.title, conversation.summary, conversation.projectName, conversation.tags.join(" "), conversation.modelNames.join(" ")].join(" ");
    const conversationHit = textMatches(conversationScope, needle, matcher, query.caseSensitive);
    if (conversationHit) {
      results.push({
        conversationId: conversation.id,
        provider: conversation.provider,
        projectName: conversation.projectName,
        title: conversation.title,
        snippet: buildSnippet(conversationScope, q),
        score: 5,
        createdAt: conversation.createdAt
      });
    }

    for (const message of conversation.messages) {
      if (query.role && message.role !== query.role) continue;
      const toolText = (message.toolCalls ?? [])
        .map((tool) => `${tool.name} ${JSON.stringify(tool.input ?? "")} ${JSON.stringify(tool.output ?? "")} ${(tool.relatedFiles ?? []).join(" ")}`)
        .join(" ");
      const haystack = `${message.content} ${toolText}`;
      if (!textMatches(haystack, needle, matcher, query.caseSensitive)) continue;
      results.push({
        conversationId: conversation.id,
        messageId: message.id,
        provider: conversation.provider,
        projectName: conversation.projectName,
        title: conversation.title,
        role: message.role,
        snippet: buildSnippet(message.content || toolText, q),
        score: scoreSearchHit(message, q),
        createdAt: message.createdAt ?? conversation.createdAt
      });
    }
  }

  return results.sort((a, b) => b.score - a.score || Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? "")).slice(0, query.limit ?? 80);
}

export function computeProjectInsights(conversations: AILogConversation[]): ProjectInsight[] {
  const grouped = new Map<string, AILogConversation[]>();
  for (const conversation of conversations) {
    const name = conversation.projectName || "Unknown Project";
    const list = grouped.get(name) ?? [];
    list.push(conversation);
    grouped.set(name, list);
  }

  return Array.from(grouped.entries())
    .map(([projectName, items]) => {
      const prompts = items.flatMap((conversation) => conversation.messages.filter((message) => message.role === "user"));
      const intentCounts = new Map<string, number>();
      const models = new Map<string, number>();
      const providerCounts = emptyProviderCounts();
      for (const conversation of items) {
        providerCounts[conversation.provider] += 1;
        for (const model of conversation.modelNames) increment(models, model);
        for (const message of conversation.messages) {
          if (message.promptIntent) increment(intentCounts, message.promptIntent);
        }
      }
      return {
        projectName,
        conversationCount: items.length,
        totalTokens: items.reduce((sum, item) => sum + (item.tokenUsage?.totalTokens ?? 0), 0),
        mainIntents: mapToWordFrequency(intentCounts),
        topPromptWords: topTerms(prompts.map((prompt) => prompt.content), 20),
        topFiles: topFilesFromMessages(items.flatMap((item) => item.messages), 20),
        topModels: mapToWordFrequency(models),
        providerCounts,
        topConversations: [...items].sort((a, b) => (b.tokenUsage?.totalTokens ?? 0) - (a.tokenUsage?.totalTokens ?? 0)).slice(0, 8)
      };
    })
    .sort((a, b) => b.conversationCount - a.conversationCount);
}

export function compareConversations(left: AILogConversation, right: AILogConversation): ConversationCompareResult {
  const leftFiles = filesForConversation(left);
  const rightFiles = filesForConversation(right);
  const leftWords = topTerms(left.messages.filter((message) => message.role === "user").map((message) => message.content), 50);
  const rightWords = topTerms(right.messages.filter((message) => message.role === "user").map((message) => message.content), 50);

  return {
    left: compactConversation(left),
    right: compactConversation(right),
    metrics: [
      metric("Messages", left.messageCount, right.messageCount),
      metric("User prompts", left.userMessageCount, right.userMessageCount),
      metric("AI replies", left.assistantMessageCount, right.assistantMessageCount),
      metric("Tokens", left.tokenUsage?.totalTokens ?? 0, right.tokenUsage?.totalTokens ?? 0),
      metric("Tool calls", left.toolCallCount, right.toolCallCount),
      metric("Files", leftFiles.length, rightFiles.length),
      metric("Errors", left.hasErrors ? 1 : 0, right.hasErrors ? 1 : 0),
      metric("Code generated", left.hasCode ? 1 : 0, right.hasCode ? 1 : 0)
    ],
    commonModels: intersection(left.modelNames, right.modelNames),
    onlyLeftModels: difference(left.modelNames, right.modelNames),
    onlyRightModels: difference(right.modelNames, left.modelNames),
    commonTags: intersection(left.tags, right.tags),
    onlyLeftTags: difference(left.tags, right.tags),
    onlyRightTags: difference(right.tags, left.tags),
    commonFiles: intersection(leftFiles, rightFiles),
    onlyLeftFiles: difference(leftFiles, rightFiles),
    onlyRightFiles: difference(rightFiles, leftFiles),
    promptKeywordDelta: {
      leftOnly: leftWords.filter((word) => !rightWords.some((item) => item.term === word.term)).slice(0, 20),
      rightOnly: rightWords.filter((word) => !leftWords.some((item) => item.term === word.term)).slice(0, 20)
    }
  };
}

export function analyzeAIBehavior(conversations: AILogConversation[]): AIBehaviorInsight {
  const replies = conversations.flatMap((conversation) => conversation.messages.filter((message) => message.role === "assistant"));
  const totalLength = replies.reduce((sum, message) => sum + message.content.length, 0);
  const codeBlocks = replies.reduce((sum, message) => sum + countCodeBlocks(message.content), 0);
  const headings = replies.filter((message) => /^#{1,4}\s+/m.test(message.content)).length;
  const lists = replies.filter((message) => /^\s*[-*]|\d+\.\s+/m.test(message.content)).length;
  const plans = replies.filter((message) => /(plan|计划|步骤|step|todo|下一步)/i.test(message.content)).length;
  const moreInfo = replies.filter((message) => /(请提供|需要你|补充|clarify|could you provide|need more)/i.test(message.content)).length;
  const longReplies = replies.filter((message) => message.content.length > 2500).length;
  const toolReplies = replies.filter((message) => (message.toolCalls?.length ?? 0) > 0).length;

  return {
    assistantReplies: replies.length,
    averageReplyLength: replies.length ? Math.round(totalLength / replies.length) : 0,
    averageCodeBlocks: replies.length ? Number((codeBlocks / replies.length).toFixed(2)) : 0,
    markdownHeadingRatio: ratio(headings, replies.length),
    listRatio: ratio(lists, replies.length),
    planRatio: ratio(plans, replies.length),
    asksForMoreInfoRatio: ratio(moreInfo, replies.length),
    longExplanationRatio: ratio(longReplies, replies.length),
    toolUseRatio: ratio(toolReplies, replies.length)
  };
}

export function computeCollaborationMetrics(conversations: AILogConversation[]): CollaborationMetrics {
  const promptTexts = conversations.flatMap((conversation) => conversation.messages.filter((message) => message.role === "user").map((message) => normalizePromptForRepeat(message.content)));
  const repeated = promptTexts.filter((prompt, index) => prompt && promptTexts.indexOf(prompt) !== index).length;
  const errorSessions = conversations.filter((conversation) => conversation.hasErrors).length;
  const longContextSessions = conversations.filter((conversation) => (conversation.tokenUsage?.totalTokens ?? 0) > 60000 || conversation.messageCount > 80).length;
  const totalTools = conversations.reduce((sum, conversation) => sum + conversation.toolCallCount, 0);
  const totalTokens = conversations.reduce((sum, conversation) => sum + (conversation.tokenUsage?.totalTokens ?? 0), 0);
  const totalTurns = conversations.reduce((sum, conversation) => sum + conversation.userMessageCount, 0);

  return {
    averageTurnsPerTask: conversations.length ? Number((totalTurns / conversations.length).toFixed(2)) : 0,
    averageToolCallsPerTask: conversations.length ? Number((totalTools / conversations.length).toFixed(2)) : 0,
    averageTokensPerTask: conversations.length ? Math.round(totalTokens / conversations.length) : 0,
    firstTrySuccessRate: conversations.length ? Number(((conversations.length - errorSessions) / conversations.length).toFixed(3)) : undefined,
    errorRecoveryCount: conversations.reduce((sum, conversation) => sum + (conversation.messages.filter((message) => /retry|重试|再次|重新/i.test(message.content)).length > 0 ? 1 : 0), 0),
    repeatedPromptRate: ratio(repeated, promptTexts.length),
    longContextSessionRate: ratio(longContextSessions, conversations.length)
  };
}

export function scanSensitiveFindings(conversations: AILogConversation[]): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  const checks: Array<{ type: SensitiveFinding["type"]; severity: SensitiveFinding["severity"]; pattern: RegExp }> = [
    { type: "openai_key", severity: "high", pattern: /sk-[A-Za-z0-9_-]{20,}/g },
    { type: "anthropic_key", severity: "high", pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g },
    { type: "github_token", severity: "high", pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
    { type: "jwt", severity: "medium", pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
    { type: "ssh_private_key", severity: "high", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
    { type: "email", severity: "low", pattern: EMAIL_RE },
    { type: "phone", severity: "medium", pattern: PHONE_RE },
    { type: "url_token", severity: "medium", pattern: /[?&](?:token|key|secret|access_token)=([^&\s]+)/gi },
    { type: "env_secret", severity: "high", pattern: /^\s*[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)\s*=\s*.+$/gim },
    { type: "path", severity: "low", pattern: /(?:[A-Za-z]:\\Users\\[^\\\s]+|\/Users\/[^/\s]+)/g }
  ];

  for (const conversation of conversations) {
    const scopes = [
      { content: conversation.sourceFilePath, messageId: undefined },
      ...conversation.messages.map((message) => ({ content: message.content, messageId: message.id }))
    ];
    for (const scope of scopes) {
      for (const check of checks) {
        check.pattern.lastIndex = 0;
        for (const match of scope.content.matchAll(check.pattern)) {
          const start = match.index ?? 0;
          const end = start + match[0].length;
          findings.push({
            id: stableId([conversation.id, scope.messageId, check.type, start, match[0].slice(0, 20)]),
            type: check.type,
            severity: check.severity,
            conversationId: conversation.id,
            messageId: scope.messageId,
            sourceFilePath: conversation.sourceFilePath,
            excerpt: redactSensitive(scope.content.slice(Math.max(0, start - 32), Math.min(scope.content.length, end + 32))),
            start,
            end
          });
        }
      }
    }
  }
  return findings;
}

export function redactSensitive(value: string): string {
  let output = value;
  for (const pattern of API_KEY_PATTERNS) {
    output = output.replace(pattern, (match, prefix) => (typeof prefix === "string" && match.startsWith(prefix) ? `${prefix}[REDACTED]` : "[REDACTED_SECRET]"));
  }
  output = output.replace(EMAIL_RE, "[REDACTED_EMAIL]");
  output = output.replace(PHONE_RE, "[REDACTED_PHONE]");
  output = output.replace(/([A-Za-z]:\\Users\\)[^\\\s]+/g, "$1[USER]");
  output = output.replace(/(\/Users\/)[^/\s]+/g, "$1[USER]");
  return output;
}

export function renderConversationMarkdown(conversation: AILogConversation, redact = true): string {
  const lines = [
    `# ${conversation.title || conversation.id}`,
    "",
    `- Provider: ${conversation.provider}`,
    `- Project: ${conversation.projectName ?? "Unknown"}`,
    `- Created: ${conversation.createdAt}`,
    `- Updated: ${conversation.updatedAt}`,
    `- Messages: ${conversation.messageCount}`,
    `- Tokens: ${conversation.tokenUsage?.totalTokens ?? 0}`,
    `- Tags: ${conversation.tags.join(", ") || "none"}`,
    ""
  ];

  for (const message of conversation.messages) {
    lines.push(`## ${message.role}${message.model ? ` - ${message.model}` : ""}`, "");
    lines.push(redact ? redactSensitive(message.content) : message.content, "");
    for (const tool of message.toolCalls ?? []) {
      lines.push(`### Tool: ${tool.name}`, "");
      lines.push(`- Type: ${tool.type}`);
      lines.push(`- Status: ${tool.status}`);
      if (tool.relatedFiles?.length) lines.push(`- Files: ${tool.relatedFiles.join(", ")}`);
      if (tool.input !== undefined) lines.push("", "```json", redact ? redactSensitive(JSON.stringify(tool.input, null, 2)) : JSON.stringify(tool.input, null, 2), "```");
      if (tool.output !== undefined) lines.push("", "```json", redact ? redactSensitive(JSON.stringify(tool.output, null, 2)) : JSON.stringify(tool.output, null, 2), "```");
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function renderConversationHtml(conversation: AILogConversation, redact = true): string {
  const body = renderConversationMarkdown(conversation, redact)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/\n/g, "<br>");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${conversation.title ?? conversation.id}</title><style>body{font-family:ui-sans-serif,system-ui;background:#111;color:#eee;max-width:980px;margin:40px auto;line-height:1.6}h1,h2,h3{color:#fff}code,pre{background:#1d1d1d;border:1px solid #333;border-radius:6px;padding:8px}</style></head><body>${body}</body></html>`;
}

export function renderConversationPdf(conversation: AILogConversation, redact = true): string {
  const text = renderConversationMarkdown(conversation, redact)
    .replace(/```[\s\S]*?```/g, (block) => block.split(/\r?\n/).slice(0, 18).join("\n"))
    .split(/\r?\n/)
    .map((line) => asciiPdfText(line))
    .flatMap((line) => wrapPdfLine(line, 92))
    .slice(0, 160);
  const pages: string[][] = [];
  for (let index = 0; index < text.length; index += 42) {
    pages.push(text.slice(index, index + 42));
  }
  if (!pages.length) pages.push(["AILog conversation export"]);

  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = add("");
  const pagesId = add("");
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  const contentIds: number[] = [];

  for (const page of pages) {
    const content = [
      "BT",
      "/F1 10 Tf",
      "50 792 Td",
      "14 TL",
      ...page.map((line) => `(${escapePdfLiteral(line)}) Tj T*`),
      "ET"
    ].join("\n");
    const contentId = add(`<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    contentIds.push(contentId);
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  void contentIds;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

function asciiPdfText(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "?").replace(/\s+/g, " ").trim();
}

function wrapPdfLine(value: string, length: number): string[] {
  if (!value) return [""];
  const lines: string[] = [];
  for (let index = 0; index < value.length; index += length) {
    lines.push(value.slice(index, index + length));
  }
  return lines;
}

function escapePdfLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function byteLength(value: string): number {
  return value.length;
}

function intentToTag(intent: PromptIntent): string {
  const map: Record<PromptIntent, string> = {
    bug_fix: "bug-fix",
    feature_request: "feature",
    code_explanation: "explanation",
    refactor: "refactor",
    test_generation: "test",
    documentation: "docs",
    debugging: "debugging",
    architecture_design: "architecture",
    code_review: "code-review",
    learning: "learning",
    translation: "translation",
    data_analysis: "data-analysis",
    devops: "devops",
    git_operation: "git",
    other: "other"
  };
  return map[intent];
}

function detectLanguage(content: string): keyof PromptInsight["languageRatio"] {
  const hasZh = CJK_RE.test(content);
  const hasEn = /[A-Za-z]/.test(content);
  if (hasZh && hasEn) return "mixed";
  if (hasZh) return "zh";
  if (hasEn) return "en";
  return "other";
}

function tokenize(content: string): string[] {
  const lower = content.toLowerCase();
  const english = lower.match(/[a-z][a-z0-9_-]{1,}/g) ?? [];
  const chinese = lower.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const chineseTokens = chinese.flatMap((chunk) => {
    if (chunk.length <= 4) return [chunk];
    const tokens: string[] = [];
    for (let index = 0; index < chunk.length - 1; index += 1) {
      tokens.push(chunk.slice(index, index + 2));
    }
    return tokens;
  });
  return [...english, ...chineseTokens].filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function topTerms(contents: string[], limit: number): WordFrequency[] {
  const counts = new Map<string, number>();
  for (const content of contents) {
    for (const token of tokenize(content)) increment(counts, token);
  }
  return mapToWordFrequency(counts).slice(0, limit);
}

function topNGrams(contents: string[], size: number, limit: number): WordFrequency[] {
  const counts = new Map<string, number>();
  for (const content of contents) {
    const tokens = tokenize(content);
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const gram = tokens.slice(index, index + size).join(" ");
      increment(counts, gram);
    }
  }
  return mapToWordFrequency(counts).slice(0, limit);
}

function topKnownTerms(contents: string[], terms: string[], limit: number): WordFrequency[] {
  const counts = new Map<string, number>();
  const corpus = contents.join("\n").toLowerCase();
  for (const term of terms) {
    const matches = corpus.match(new RegExp(`\\b${escapeRegExp(term.toLowerCase())}\\b`, "g"));
    if (matches?.length) counts.set(term, matches.length);
  }
  return mapToWordFrequency(counts).slice(0, limit);
}

function topFilesFromMessages(messages: AILogMessage[], limit: number): WordFrequency[] {
  const counts = new Map<string, number>();
  for (const message of messages) {
    for (const match of message.content.match(FILE_RE) ?? []) increment(counts, match);
    for (const tool of message.toolCalls ?? []) {
      for (const file of tool.relatedFiles ?? []) increment(counts, file);
    }
  }
  return mapToWordFrequency(counts).slice(0, limit);
}

function emptyIntentCounts(): Record<PromptIntent, number> {
  return {
    bug_fix: 0,
    feature_request: 0,
    code_explanation: 0,
    refactor: 0,
    test_generation: 0,
    documentation: 0,
    debugging: 0,
    architecture_design: 0,
    code_review: 0,
    learning: 0,
    translation: 0,
    data_analysis: 0,
    devops: 0,
    git_operation: 0,
    other: 0
  };
}

function emptyProviderCounts(): Record<Provider, number> {
  return {
    "claude-code": 0,
    "codex-cli": 0,
    openai: 0,
    anthropic: 0,
    gemini: 0,
    unknown: 0
  };
}

function averageQuality(scores: PromptQualityScore[]): PromptQualityScore | undefined {
  if (!scores.length) return undefined;
  const base = scores.reduce(
    (sum, score) => ({
      clarity: sum.clarity + score.clarity,
      context: sum.context + score.context,
      specificity: sum.specificity + score.specificity,
      constraints: sum.constraints + score.constraints,
      examples: sum.examples + score.examples,
      total: sum.total + score.total,
      missingSignals: []
    }),
    { clarity: 0, context: 0, specificity: 0, constraints: 0, examples: 0, total: 0, missingSignals: [] } satisfies PromptQualityScore
  );
  return {
    clarity: Math.round(base.clarity / scores.length),
    context: Math.round(base.context / scores.length),
    specificity: Math.round(base.specificity / scores.length),
    constraints: Math.round(base.constraints / scores.length),
    examples: Math.round(base.examples / scores.length),
    total: Math.round(base.total / scores.length),
    missingSignals: []
  };
}

function ratio(value: number, total: number): number {
  return total ? Number((value / total).toFixed(3)) : 0;
}

function ratioObject<T extends Record<string, number>>(counts: T, total: number): T {
  const output = { ...counts };
  for (const key of Object.keys(output)) {
    output[key as keyof T] = ratio(output[key as keyof T] as number, total) as T[keyof T];
  }
  return output;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? Math.round(((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2) : values[middle] ?? 0;
}

function increment(map: Map<string, number>, key: string): void {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function mapToWordFrequency(map: Map<string, number>): WordFrequency[] {
  return Array.from(map.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}

function metric(label: string, left: number | string, right: number | string): ConversationCompareResult["metrics"][number] {
  return {
    label,
    left,
    right,
    delta: typeof left === "number" && typeof right === "number" ? right - left : undefined
  };
}

function intersection(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return Array.from(new Set(left.filter((item) => rightSet.has(item)))).sort();
}

function difference(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return Array.from(new Set(left.filter((item) => !rightSet.has(item)))).sort();
}

function filesForConversation(conversation: AILogConversation): string[] {
  return Array.from(new Set(conversation.messages.flatMap((message) => message.toolCalls ?? []).flatMap((tool) => tool.relatedFiles ?? []))).sort();
}

function normalizePromptForRepeat(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 220);
}

function sortConversations(conversations: AILogConversation[], sort: NonNullable<ConversationFilters["sort"]>): AILogConversation[] {
  const sorted = [...conversations];
  const byDate = (a: AILogConversation, b: AILogConversation) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  switch (sort) {
    case "oldest":
      return sorted.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
    case "token_desc":
      return sorted.sort((a, b) => (b.tokenUsage?.totalTokens ?? 0) - (a.tokenUsage?.totalTokens ?? 0));
    case "tool_desc":
      return sorted.sort((a, b) => b.toolCallCount - a.toolCallCount);
    case "duration_desc":
      return sorted.sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0));
    case "user_messages_desc":
      return sorted.sort((a, b) => b.userMessageCount - a.userMessageCount);
    case "assistant_messages_desc":
      return sorted.sort((a, b) => b.assistantMessageCount - a.assistantMessageCount);
    case "newest":
    default:
      return sorted.sort(byDate);
  }
}

function textMatches(haystack: string, needle: string, matcher: RegExp | undefined, caseSensitive = false): boolean {
  if (matcher) return matcher.test(haystack);
  return (caseSensitive ? haystack : haystack.toLowerCase()).includes(needle);
}

function scoreSearchHit(message: AILogMessage, q: string): number {
  const base = message.role === "user" ? 10 : message.role === "assistant" ? 7 : 5;
  const firstIndex = message.content.toLowerCase().indexOf(q.toLowerCase());
  return base + (firstIndex >= 0 && firstIndex < 120 ? 3 : 0) + Math.min(3, Math.round(q.length / 12));
}

function buildSnippet(content: string, q: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  const index = compact.toLowerCase().indexOf(q.toLowerCase());
  if (index < 0) return truncate(compact, 220);
  const start = Math.max(0, index - 80);
  const end = Math.min(compact.length, index + q.length + 120);
  return `${start > 0 ? "..." : ""}${compact.slice(start, end)}${end < compact.length ? "..." : ""}`;
}

function getWeekKey(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compactConversation(conversation: AILogConversation): AILogConversation {
  return { ...conversation, messages: [] };
}

export function recomputeConversationStats(conversation: AILogConversation): AILogConversation {
  const modelNames = Array.from(new Set(conversation.messages.map((message) => message.model).filter(Boolean) as string[]));
  const messageCount = conversation.messages.length;
  const userMessageCount = conversation.messages.filter((message) => message.role === "user").length;
  const assistantMessageCount = conversation.messages.filter((message) => message.role === "assistant").length;
  const toolCalls = conversation.messages.flatMap((message) => message.toolCalls ?? []);
  const tokenUsage = sumTokenUsage(conversation.messages.map((message) => message.tokenUsage));
  const createdAt = conversation.messages.map((message) => message.createdAt).filter(Boolean).sort()[0] ?? conversation.createdAt;
  const updatedAt = conversation.messages.map((message) => message.createdAt).filter(Boolean).sort().at(-1) ?? conversation.updatedAt;
  const hasErrors = conversation.messages.some((message) => message.role === "error" || ERROR_RE.test(message.content) || message.toolCalls?.some((tool) => tool.status === "error"));
  const hasCode = conversation.messages.some((message) => /```|function |class |const |let |import /.test(message.content));
  const hasShell = toolCalls.some((tool) => tool.type === "shell");
  const hasMcp = toolCalls.some((tool) => tool.type === "mcp");
  const relatedFiles = new Set(toolCalls.flatMap((tool) => tool.relatedFiles ?? []));

  return {
    ...conversation,
    id: conversation.id || stableId([conversation.provider, conversation.sourceFilePath, createdAt]),
    createdAt,
    updatedAt,
    durationMs: Date.parse(updatedAt) - Date.parse(createdAt) || conversation.durationMs,
    modelNames,
    messageCount,
    userMessageCount,
    assistantMessageCount,
    toolCallCount: toolCalls.length,
    tokenUsage: conversation.tokenUsage ?? tokenUsage,
    hasErrors,
    hasCode,
    hasShell,
    hasMcp,
    modifiedFileCount: relatedFiles.size,
    title: conversation.title || deriveTitle(conversation.messages),
    summary: conversation.summary || deriveSummary(conversation.messages)
  };
}

function deriveTitle(messages: AILogMessage[]): string {
  const firstUser = messages.find((message) => message.role === "user")?.content;
  return firstUser ? truncate(firstUser, 86) : "Untitled conversation";
}

function deriveSummary(messages: AILogMessage[]): string {
  const firstUser = messages.find((message) => message.role === "user")?.content;
  const firstAssistant = messages.find((message) => message.role === "assistant")?.content;
  return truncate([firstUser, firstAssistant].filter(Boolean).join(" / "), 240);
}

export function mergeConversationState(next: AILogConversation, previous?: AILogConversation): AILogConversation {
  if (!previous) return next;
  return {
    ...next,
    tags: Array.from(new Set([...next.tags, ...previous.tags])).sort(),
    favorite: previous.favorite ?? next.favorite,
    title: previous.title || next.title,
    summary: previous.summary || next.summary,
    messages: next.messages.map((message) => {
      const prior = previous.messages.find((item) => item.id === message.id);
      return prior ? { ...message, tags: Array.from(new Set([...(message.tags ?? []), ...(prior.tags ?? [])])), favorite: prior.favorite ?? message.favorite } : message;
    })
  };
}

export function toolTypeFromName(name: string): AILogToolCall["type"] {
  const lower = name.toLowerCase();
  if (/bash|shell|terminal|cmd|powershell|exec/.test(lower)) return "shell";
  if (/read|write|edit|patch|file|fs/.test(lower)) return /edit|write|patch/.test(lower) ? "edit" : "file";
  if (/search|grep|rg|find/.test(lower)) return "search";
  if (/web|browser|fetch|http/.test(lower)) return "web";
  if (/mcp|tool__/.test(lower)) return "mcp";
  return "unknown";
}

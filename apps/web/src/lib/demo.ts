import type {
  AILogConversation,
  AILogMessage,
  AILogSettings,
  AIBehaviorInsight,
  BackupManifest,
  CapabilityStatus,
  CollaborationMetrics,
  ConversationCompareResult,
  ConversationFilters,
  ExportRequest,
  ExportResult,
  IndexMaintenanceResult,
  LiveSession,
  OverviewStats,
  PromptInsight,
  PromptLibraryItem,
  ProjectInsight,
  SearchQuery,
  SearchResult,
  SensitiveFinding,
  TeamWorkspace
} from "@ailog/shared";

const now = new Date().toISOString();

export const demoSettings: AILogSettings = {
  claudeDirs: ["~/.claude"],
  codexDirs: ["~/.codex"],
  importDirs: [],
  autoScan: false,
  scanIntervalMinutes: 15,
  useSQLiteIndex: true,
  fullTextSearch: true,
  sensitiveScan: true,
  autoTagging: true,
  promptQualityScoring: true,
  advancedAIAnalysis: false,
  theme: "dark",
  language: "zh-CN",
  redactExports: true,
  readOnlySources: true,
  localLlmEndpoint: "",
  localLlmModel: "llama3.2",
  localLlmTimeoutMs: 15000
};

const messages: AILogMessage[] = [
  {
    id: "demo-message-1",
    conversationId: "demo-conversation",
    role: "user",
    content: "Build a local-first dashboard that can analyze Claude Code and Codex CLI history like a Git log.",
    createdAt: now,
    promptIntent: "feature_request",
    promptQuality: {
      clarity: 18,
      context: 17,
      specificity: 16,
      constraints: 15,
      examples: 8,
      total: 74,
      missingSignals: ["examples"]
    },
    tags: ["high-quality-prompt"]
  },
  {
    id: "demo-message-2",
    conversationId: "demo-conversation",
    role: "assistant",
    model: "gpt-5-codex",
    content: "Implemented parser adapters, prompt intelligence, dashboard metrics, search, export, and privacy scanning. The local API remains private by default.",
    createdAt: now,
    toolCalls: [
      {
        id: "demo-tool-1",
        name: "rg",
        type: "search",
        input: "rg parser packages",
        status: "success",
        relatedFiles: ["packages/parser/src/index.ts"]
      },
      {
        id: "demo-tool-2",
        name: "apply_patch",
        type: "edit",
        input: "Update dashboard and export code",
        status: "success",
        relatedFiles: ["apps/web/src/views/DashboardView.vue", "packages/core/src/index.ts"]
      }
    ]
  }
];
const firstMessage = messages[0] as AILogMessage;

export const demoConversation: AILogConversation = {
  id: "demo-conversation",
  provider: "codex-cli",
  projectName: "AILog",
  projectPath: "/workspace/AILog",
  title: "Ship local-first AI collaboration observability",
  summary: "A demo conversation showing how AILog turns local AI coding history into searchable dashboards and reusable prompt intelligence.",
  createdAt: now,
  updatedAt: now,
  durationMs: 1000 * 60 * 34,
  modelNames: ["gpt-5-codex"],
  messageCount: messages.length,
  userMessageCount: 1,
  assistantMessageCount: 1,
  toolCallCount: 2,
  tokenUsage: { inputTokens: 3400, outputTokens: 5100, totalTokens: 8500 },
  tags: ["feature", "code-generation", "reusable"],
  favorite: true,
  sourceFilePath: "demo://github-pages",
  hasCode: true,
  hasShell: false,
  hasMcp: true,
  modifiedFileCount: 4,
  messages
};

export const demoConversations = [demoConversation];

export const demoOverview: OverviewStats = {
  totalConversations: 128,
  totalMessages: 942,
  userPrompts: 371,
  assistantReplies: 384,
  totalTokens: 1842300,
  averageTokensPerConversation: 14393,
  totalToolCalls: 517,
  topModel: "gpt-5-codex",
  topProject: "AILog",
  providerCounts: { "claude-code": 52, "codex-cli": 68, openai: 6, anthropic: 1, gemini: 1, unknown: 0 },
  modelCounts: [{ term: "gpt-5-codex", count: 68 }, { term: "claude-sonnet", count: 52 }],
  projectCounts: [{ term: "AILog", count: 84 }, { term: "Data Tools", count: 22 }],
  toolCounts: [{ term: "shell", count: 188 }, { term: "apply_patch", count: 142 }, { term: "rg", count: 93 }],
  failedToolCounts: [{ term: "shell", count: 9 }],
  dailyActivity: Array.from({ length: 14 }, (_, index) => ({
    date: new Date(Date.now() - (13 - index) * 86400000).toISOString().slice(0, 10),
    count: 4 + (index % 5),
    tokens: 22000 + index * 1800
  })),
  hourlyActivity: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hour >= 9 && hour <= 22 ? (hour % 5) + 1 : 0 })),
  weeklyActivity: [{ week: "2026-W20", count: 31, tokens: 420000 }, { week: "2026-W21", count: 43, tokens: 610000 }],
  highCostConversations: demoConversations,
  longConversations: demoConversations,
  recentTimeline: demoConversations
};

export const demoPromptInsight: PromptInsight = {
  totalPrompts: 371,
  averageLength: 214,
  medianLength: 168,
  shortestPrompt: messages[0],
  longestPrompt: messages[0],
  languageRatio: { zh: 0.42, en: 0.28, mixed: 0.26, other: 0.04 },
  questionRatio: 0.31,
  imperativeRatio: 0.64,
  codeBlockRatio: 0.18,
  filePathRatio: 0.37,
  errorLogRatio: 0.16,
  requirementRatio: 0.44,
  keywordRatio: 0.71,
  topWords: [{ term: "fix", count: 48 }, { term: "implement", count: 41 }, { term: "dashboard", count: 29 }, { term: "parser", count: 25 }],
  topPhrases: [{ term: "local first", count: 18 }, { term: "prompt intelligence", count: 13 }],
  topTechTerms: [{ term: "vue", count: 24 }, { term: "fastify", count: 19 }, { term: "sqlite", count: 16 }],
  topFiles: [{ term: "packages/core/src/index.ts", count: 12 }, { term: "apps/web/src/App.vue", count: 9 }],
  intentCounts: {
    bug_fix: 76,
    feature_request: 118,
    code_explanation: 22,
    refactor: 31,
    test_generation: 24,
    documentation: 18,
    debugging: 27,
    architecture_design: 19,
    code_review: 11,
    learning: 8,
    translation: 4,
    data_analysis: 5,
    devops: 5,
    git_operation: 3,
    other: 0
  },
  qualityAverage: { clarity: 16, context: 14, specificity: 15, constraints: 12, examples: 8, total: 65, missingSignals: [] },
  highQualityPrompts: [firstMessage],
  lowQualityPrompts: [],
  missingSignalCounts: { examples: 142, constraints: 93, context: 51 }
};

export const demoProjects: ProjectInsight[] = [
  {
    projectName: "AILog",
    conversationCount: 84,
    totalTokens: 1120000,
    mainIntents: [{ term: "feature_request", count: 42 }, { term: "bug_fix", count: 21 }],
    topPromptWords: demoPromptInsight.topWords,
    topFiles: demoPromptInsight.topFiles,
    topModels: demoOverview.modelCounts,
    providerCounts: demoOverview.providerCounts,
    topConversations: demoConversations
  }
];

export const demoCapabilities: CapabilityStatus[] = [
  { id: "static-demo", name: "GitHub Pages demo", status: "ready", localFirst: true, description: "Static demo mode for the hosted website." },
  { id: "local-api", name: "Local API", status: "ready", localFirst: true, description: "Run pnpm dev locally to scan private AI history.", entry: "http://127.0.0.1:1421" }
];

export function demoSearch(query: SearchQuery): SearchResult[] {
  if (!query.q.trim()) return [];
  return [
    {
      conversationId: demoConversation.id,
      messageId: firstMessage.id,
      provider: demoConversation.provider,
      projectName: demoConversation.projectName,
      title: demoConversation.title,
      role: "user",
      snippet: firstMessage.content,
      score: 10,
      createdAt: now
    }
  ];
}

export function demoCompare(): ConversationCompareResult {
  return {
    left: demoConversation,
    right: { ...demoConversation, id: "demo-conversation-2", provider: "claude-code", title: "Alternative Claude run" },
    metrics: [
      { label: "Tokens", left: 8500, right: 7400, delta: -1100 },
      { label: "Tool calls", left: 2, right: 3, delta: 1 }
    ],
    commonModels: [],
    onlyLeftModels: ["gpt-5-codex"],
    onlyRightModels: ["claude-sonnet"],
    commonTags: ["feature"],
    onlyLeftTags: ["reusable"],
    onlyRightTags: ["architecture"],
    commonFiles: ["packages/core/src/index.ts"],
    onlyLeftFiles: ["apps/web/src/views/DashboardView.vue"],
    onlyRightFiles: ["docs/architecture.md"],
    promptKeywordDelta: { leftOnly: [{ term: "dashboard", count: 3 }], rightOnly: [{ term: "architecture", count: 2 }] }
  };
}

export function demoExport(format: ExportRequest["format"]): ExportResult {
  const base = "# AILog Demo Conversation\n\nThis is a static GitHub Pages demo export.";
  if (format === "json") return { filename: "ailog-demo.json", contentType: "application/json", content: JSON.stringify(demoConversation, null, 2) };
  if (format === "html") return { filename: "ailog-demo.html", contentType: "text/html", content: `<!doctype html><html><body><pre>${base}</pre></body></html>` };
  if (format === "pdf") return { filename: "ailog-demo.pdf", contentType: "application/pdf", content: "%PDF-1.4\n% AILog static demo\n%%EOF\n" };
  return { filename: "ailog-demo.md", contentType: "text/markdown", content: base };
}

export const demoAiBehavior: AIBehaviorInsight = {
  assistantReplies: 384,
  averageReplyLength: 1480,
  averageCodeBlocks: 2.1,
  markdownHeadingRatio: 0.52,
  listRatio: 0.67,
  planRatio: 0.39,
  asksForMoreInfoRatio: 0.06,
  longExplanationRatio: 0.24,
  toolUseRatio: 0.58
};

export const demoCollaboration: CollaborationMetrics = {
  averageTurnsPerTask: 2.9,
  averageToolCallsPerTask: 4.04,
  averageTokensPerTask: 14393,
  firstTrySuccessRate: 0.82,
  errorRecoveryCount: 17,
  repeatedPromptRate: 0.08,
  longContextSessionRate: 0.12
};

export const demoSensitiveFindings: SensitiveFinding[] = [];
export const demoLiveSessions: LiveSession[] = [];
export const demoPromptLibrary: PromptLibraryItem[] = [
  {
    id: "demo-library-1",
    conversationId: demoConversation.id,
    messageId: firstMessage.id,
    projectName: "AILog",
    title: "Local-first dashboard prompt",
    content: firstMessage.content,
    group: "Architecture",
    tags: ["feature", "dashboard"],
    score: 74,
    intent: "feature_request",
    useCount: 4,
    favorite: true,
    createdAt: now,
    updatedAt: now
  }
];

export const demoBackup: { manifest: BackupManifest; content: string } = {
  manifest: { version: 1, generatedAt: now, conversations: 1, promptLibraryItems: 1, settings: demoSettings },
  content: JSON.stringify({ demo: true, conversation: demoConversation }, null, 2)
};

export const demoTeamWorkspaces: TeamWorkspace[] = [];
export const demoMaintenance: IndexMaintenanceResult = { conversations: 0, promptLibraryItems: 0, liveSessions: 0, teamWorkspaces: 0, sqliteRebuilt: false };

export function filterDemoConversations(filters: ConversationFilters = {}): AILogConversation[] {
  if (filters.provider && filters.provider !== demoConversation.provider) return [];
  if (filters.keyword && !JSON.stringify(demoConversation).toLowerCase().includes(filters.keyword.toLowerCase())) return [];
  return demoConversations;
}

export type Provider =
  | "claude-code"
  | "codex-cli"
  | "openai"
  | "anthropic"
  | "gemini"
  | "unknown";

export type AILogRole = "user" | "assistant" | "system" | "tool" | "error" | "event";

export type ToolCallType = "file" | "shell" | "mcp" | "web" | "edit" | "search" | "unknown";

export type ToolCallStatus = "success" | "error" | "pending" | "unknown";

export type PromptIntent =
  | "bug_fix"
  | "feature_request"
  | "code_explanation"
  | "refactor"
  | "test_generation"
  | "documentation"
  | "debugging"
  | "architecture_design"
  | "code_review"
  | "learning"
  | "translation"
  | "data_analysis"
  | "devops"
  | "git_operation"
  | "other";

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
}

export interface AILogAttachment {
  id: string;
  name?: string;
  mimeType?: string;
  path?: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}

export interface AILogToolCall {
  id: string;
  name: string;
  type: ToolCallType;
  input?: unknown;
  output?: unknown;
  status: ToolCallStatus;
  durationMs?: number;
  relatedFiles?: string[];
}

export interface PromptQualityScore {
  clarity: number;
  context: number;
  specificity: number;
  constraints: number;
  examples: number;
  total: number;
  missingSignals: string[];
}

export interface AILogMessage {
  id: string;
  conversationId: string;
  role: AILogRole;
  providerRole?: string;
  content: string;
  rawContent?: unknown;
  createdAt?: string;
  model?: string;
  tokenUsage?: TokenUsage;
  toolCalls?: AILogToolCall[];
  attachments?: AILogAttachment[];
  promptIntent?: PromptIntent;
  promptQuality?: PromptQualityScore;
  tags?: string[];
  favorite?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AILogConversation {
  id: string;
  provider: Provider;
  projectName?: string;
  projectPath?: string;
  title?: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  durationMs?: number;
  modelNames: string[];
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  tokenUsage?: TokenUsage;
  tags: string[];
  favorite?: boolean;
  sourceFilePath: string;
  hasErrors?: boolean;
  hasCode?: boolean;
  hasShell?: boolean;
  hasMcp?: boolean;
  modifiedFileCount?: number;
  messages: AILogMessage[];
  metadata?: Record<string, unknown>;
}

export interface ScanSource {
  id: string;
  label: string;
  provider: Provider;
  path: string;
  enabled: boolean;
}

export interface AILogSettings {
  claudeDirs: string[];
  codexDirs: string[];
  importDirs: string[];
  autoScan: boolean;
  scanIntervalMinutes: number;
  useSQLiteIndex: boolean;
  fullTextSearch: boolean;
  sensitiveScan: boolean;
  autoTagging: boolean;
  promptQualityScoring: boolean;
  advancedAIAnalysis: boolean;
  theme: "dark" | "light" | "system";
  language: "zh-CN" | "en-US";
  redactExports: boolean;
  readOnlySources: boolean;
}

export interface ScanResult {
  scannedFiles: number;
  skippedFiles: number;
  conversations: number;
  errors: Array<{ filePath: string; message: string }>;
  startedAt: string;
  finishedAt: string;
}

export interface ConversationFilters {
  provider?: Provider;
  projectName?: string;
  model?: string;
  tag?: string;
  keyword?: string;
  hasToolCalls?: boolean;
  hasErrors?: boolean;
  hasShell?: boolean;
  from?: string;
  to?: string;
  minTokens?: number;
  maxTokens?: number;
  intent?: PromptIntent;
  sort?:
    | "newest"
    | "oldest"
    | "token_desc"
    | "tool_desc"
    | "duration_desc"
    | "user_messages_desc"
    | "assistant_messages_desc";
}

export interface SearchQuery {
  q: string;
  provider?: Provider;
  projectName?: string;
  role?: AILogRole;
  from?: string;
  to?: string;
  regex?: boolean;
  caseSensitive?: boolean;
  limit?: number;
}

export interface SearchResult {
  conversationId: string;
  messageId?: string;
  provider: Provider;
  projectName?: string;
  title?: string;
  role?: AILogRole;
  snippet: string;
  score: number;
  createdAt?: string;
}

export interface WordFrequency {
  term: string;
  count: number;
}

export interface PromptInsight {
  totalPrompts: number;
  averageLength: number;
  medianLength: number;
  shortestPrompt?: AILogMessage;
  longestPrompt?: AILogMessage;
  languageRatio: {
    zh: number;
    en: number;
    mixed: number;
    other: number;
  };
  questionRatio: number;
  imperativeRatio: number;
  codeBlockRatio: number;
  filePathRatio: number;
  errorLogRatio: number;
  requirementRatio: number;
  keywordRatio: number;
  topWords: WordFrequency[];
  topPhrases: WordFrequency[];
  topTechTerms: WordFrequency[];
  topFiles: WordFrequency[];
  intentCounts: Record<PromptIntent, number>;
  qualityAverage?: PromptQualityScore;
  highQualityPrompts: AILogMessage[];
  lowQualityPrompts: AILogMessage[];
  missingSignalCounts: Record<string, number>;
}

export interface OverviewStats {
  totalConversations: number;
  totalMessages: number;
  userPrompts: number;
  assistantReplies: number;
  totalTokens: number;
  averageTokensPerConversation: number;
  totalToolCalls: number;
  topModel?: string;
  topProject?: string;
  providerCounts: Record<Provider, number>;
  modelCounts: WordFrequency[];
  projectCounts: WordFrequency[];
  toolCounts: WordFrequency[];
  failedToolCounts: WordFrequency[];
  dailyActivity: Array<{ date: string; count: number; tokens: number }>;
  hourlyActivity: Array<{ hour: number; count: number }>;
  weeklyActivity: Array<{ week: string; count: number; tokens: number }>;
  highCostConversations: AILogConversation[];
  longConversations: AILogConversation[];
  recentTimeline: AILogConversation[];
}

export interface ProjectInsight {
  projectName: string;
  conversationCount: number;
  totalTokens: number;
  mainIntents: WordFrequency[];
  topPromptWords: WordFrequency[];
  topFiles: WordFrequency[];
  topModels: WordFrequency[];
  providerCounts: Record<Provider, number>;
  topConversations: AILogConversation[];
}

export interface ExportRequest {
  format: "markdown" | "json" | "html";
  redact?: boolean;
}

export interface ExportResult {
  filename: string;
  contentType: string;
  content: string;
}

export interface AILogIndex {
  version: number;
  generatedAt: string;
  conversations: AILogConversation[];
}


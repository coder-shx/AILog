import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  analyzePrompts,
  compactConversation,
  computeOverviewStats,
  computeProjectInsights,
  filterConversations,
  mergeConversationState,
  redactSensitive,
  renderConversationHtml,
  renderConversationMarkdown,
  searchConversations
} from "@ailog/analyzer";
import { pathExists, scanSources } from "@ailog/parser";
import {
  defaultSettings,
  isoNow,
  type AILogConversation,
  type AILogIndex,
  type AILogSettings,
  type ConversationFilters,
  type ExportRequest,
  type ExportResult,
  type ProjectInsight,
  type Provider,
  type ScanResult,
  type SearchQuery
} from "@ailog/shared";

export interface RepositoryOptions {
  workspaceRoot?: string;
  dataDir?: string;
}

export interface ScanRequest {
  roots?: Array<{ path: string; provider?: Provider; projectName?: string }>;
}

export interface DoctorResult {
  workspaceRoot: string;
  dataDir: string;
  settingsPath: string;
  indexPath: string;
  sources: Array<{ path: string; provider: Provider; exists: boolean }>;
  indexedConversations: number;
}

export class AILogRepository {
  readonly workspaceRoot: string;
  readonly dataDir: string;
  readonly settingsPath: string;
  readonly indexPath: string;

  constructor(options: RepositoryOptions = {}) {
    this.workspaceRoot = options.workspaceRoot ?? findWorkspaceRoot(process.cwd());
    this.dataDir = options.dataDir ?? path.join(this.workspaceRoot, ".ailog");
    this.settingsPath = path.join(this.dataDir, "settings.json");
    this.indexPath = path.join(this.dataDir, "index.json");
  }

  async getSettings(): Promise<AILogSettings> {
    await this.ensureDataDir();
    const fallback = normalizeSettings(defaultSettings(os.homedir()));
    if (!(await pathExists(this.settingsPath))) {
      await this.saveSettings(fallback);
      return fallback;
    }
    const raw = await readJson<Partial<AILogSettings>>(this.settingsPath, {});
    return normalizeSettings({ ...fallback, ...raw });
  }

  async saveSettings(settings: AILogSettings): Promise<AILogSettings> {
    await this.ensureDataDir();
    const normalized = normalizeSettings(settings);
    await writeJson(this.settingsPath, normalized);
    return normalized;
  }

  async scan(request: ScanRequest = {}): Promise<{ result: ScanResult; conversations: AILogConversation[] }> {
    await this.ensureDataDir();
    const previous = await this.loadIndex();
    const settings = await this.getSettings();
    const roots = (request.roots?.length ? request.roots : rootsFromSettings(settings)).map((source) => ({
      ...source,
      path: resolveSourcePath(source.path, this.workspaceRoot)
    }));
    const { result, conversations } = await scanSources({ roots });
    const previousById = new Map(previous.conversations.map((conversation) => [conversation.id, conversation]));
    const merged = conversations.map((conversation) => mergeConversationState(conversation, previousById.get(conversation.id)));
    await this.saveIndex(merged);
    return { result, conversations: merged };
  }

  async loadIndex(): Promise<AILogIndex> {
    await this.ensureDataDir();
    if (!(await pathExists(this.indexPath))) {
      return { version: 1, generatedAt: isoNow(), conversations: [] };
    }
    const index = await readJson<AILogIndex>(this.indexPath, { version: 1, generatedAt: isoNow(), conversations: [] });
    return {
      version: index.version ?? 1,
      generatedAt: index.generatedAt ?? isoNow(),
      conversations: Array.isArray(index.conversations) ? index.conversations : []
    };
  }

  async saveIndex(conversations: AILogConversation[]): Promise<void> {
    await this.ensureDataDir();
    const index: AILogIndex = {
      version: 1,
      generatedAt: isoNow(),
      conversations: conversations.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    };
    await writeJson(this.indexPath, index);
  }

  async listConversations(filters: ConversationFilters = {}, includeMessages = false): Promise<AILogConversation[]> {
    const index = await this.loadIndex();
    const filtered = filterConversations(index.conversations, filters);
    return includeMessages ? filtered : filtered.map(compactConversation);
  }

  async getConversation(id: string): Promise<AILogConversation | undefined> {
    const index = await this.loadIndex();
    return index.conversations.find((conversation) => conversation.id === id);
  }

  async updateConversationTags(id: string, tags: string[]): Promise<AILogConversation | undefined> {
    const index = await this.loadIndex();
    const conversation = index.conversations.find((item) => item.id === id);
    if (!conversation) return undefined;
    conversation.tags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).sort();
    await this.saveIndex(index.conversations);
    return conversation;
  }

  async setConversationFavorite(id: string, favorite: boolean): Promise<AILogConversation | undefined> {
    const index = await this.loadIndex();
    const conversation = index.conversations.find((item) => item.id === id);
    if (!conversation) return undefined;
    conversation.favorite = favorite;
    await this.saveIndex(index.conversations);
    return conversation;
  }

  async search(query: SearchQuery) {
    const index = await this.loadIndex();
    return searchConversations(index.conversations, query);
  }

  async overview() {
    const index = await this.loadIndex();
    return computeOverviewStats(index.conversations);
  }

  async promptInsight() {
    const index = await this.loadIndex();
    return analyzePrompts(index.conversations);
  }

  async projectInsights(): Promise<ProjectInsight[]> {
    const index = await this.loadIndex();
    return computeProjectInsights(index.conversations);
  }

  async promptLibrary() {
    const index = await this.loadIndex();
    const insight = analyzePrompts(index.conversations);
    const favorites = index.conversations.flatMap((conversation) =>
      conversation.messages
        .filter((message) => message.role === "user" && (message.favorite || (message.promptQuality?.total ?? 0) >= 78))
        .map((message) => ({
          id: message.id,
          conversationId: conversation.id,
          projectName: conversation.projectName,
          title: conversation.title,
          content: message.content,
          tags: message.tags ?? [],
          score: message.promptQuality?.total ?? 0,
          intent: message.promptIntent,
          createdAt: message.createdAt ?? conversation.createdAt
        }))
    );
    return [...favorites, ...insight.highQualityPrompts.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      tags: message.tags ?? [],
      score: message.promptQuality?.total ?? 0,
      intent: message.promptIntent,
      createdAt: message.createdAt
    }))].slice(0, 80);
  }

  async exportConversation(id: string, request: ExportRequest): Promise<ExportResult | undefined> {
    const conversation = await this.getConversation(id);
    if (!conversation) return undefined;
    const redact = request.redact ?? true;
    if (request.format === "json") {
      const content = JSON.stringify(conversation, null, 2);
      return {
        filename: `${safeFilename(conversation.title ?? conversation.id)}.json`,
        contentType: "application/json; charset=utf-8",
        content: redact ? redactSensitive(content) : content
      };
    }
    if (request.format === "html") {
      return {
        filename: `${safeFilename(conversation.title ?? conversation.id)}.html`,
        contentType: "text/html; charset=utf-8",
        content: renderConversationHtml(conversation, redact)
      };
    }
    return {
      filename: `${safeFilename(conversation.title ?? conversation.id)}.md`,
      contentType: "text/markdown; charset=utf-8",
      content: renderConversationMarkdown(conversation, redact)
    };
  }

  async exportReport(type = "weekly", redact = true): Promise<ExportResult> {
    const index = await this.loadIndex();
    const overview = computeOverviewStats(index.conversations);
    const prompts = analyzePrompts(index.conversations);
    const projects = computeProjectInsights(index.conversations).slice(0, 8);
    const title = type === "monthly" ? "AILog Monthly Report" : type === "project" ? "AILog Project Report" : "AILog Weekly Report";
    const lines = [
      `# ${title}`,
      "",
      `Generated at: ${new Date().toLocaleString()}`,
      "",
      `本期共记录 ${overview.totalConversations} 次 AI 协作，${overview.totalMessages} 条消息，${overview.totalTokens} tokens。`,
      `最常使用模型：${overview.topModel ?? "N/A"}；最活跃项目：${overview.topProject ?? "N/A"}。`,
      "",
      "## Prompt Intelligence",
      "",
      `- Prompt 总数：${prompts.totalPrompts}`,
      `- 平均长度：${prompts.averageLength}`,
      `- 平均质量分：${prompts.qualityAverage?.total ?? 0}`,
      `- 高频词：${prompts.topWords.slice(0, 12).map((item) => `${item.term}(${item.count})`).join(", ") || "N/A"}`,
      "",
      "## Projects",
      "",
      ...projects.map((project) => `- ${project.projectName}: ${project.conversationCount} conversations, ${project.totalTokens} tokens`),
      "",
      "## Recent Timeline",
      "",
      ...overview.recentTimeline.slice(0, 10).map((conversation) => `- ${conversation.updatedAt.slice(0, 10)} ${conversation.projectName ?? "Unknown"} - ${conversation.title ?? conversation.id}`)
    ];
    const content = lines.join("\n");
    return {
      filename: `${safeFilename(title.toLowerCase().replace(/\s+/g, "-"))}.md`,
      contentType: "text/markdown; charset=utf-8",
      content: redact ? redactSensitive(content) : content
    };
  }

  async doctor(): Promise<DoctorResult> {
    const settings = await this.getSettings();
    const sources = await Promise.all(
      rootsFromSettings(settings).map(async (source) => ({
        path: source.path,
        provider: source.provider ?? "unknown",
        exists: await pathExists(source.path)
      }))
    );
    const index = await this.loadIndex();
    return {
      workspaceRoot: this.workspaceRoot,
      dataDir: this.dataDir,
      settingsPath: this.settingsPath,
      indexPath: this.indexPath,
      sources,
      indexedConversations: index.conversations.length
    };
  }

  private async ensureDataDir(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
  }
}

export function rootsFromSettings(settings: AILogSettings): Array<{ path: string; provider: Provider }> {
  return [
    ...settings.claudeDirs.map((sourcePath) => ({ path: expandHome(sourcePath), provider: "claude-code" as const })),
    ...settings.codexDirs.map((sourcePath) => ({ path: expandHome(sourcePath), provider: "codex-cli" as const })),
    ...settings.importDirs.map((sourcePath) => ({ path: expandHome(sourcePath), provider: "unknown" as const }))
  ].filter((source) => source.path.trim());
}

export function findWorkspaceRoot(start: string): string {
  let current = path.resolve(start);
  let nearestPackageRoot: string | undefined;
  while (true) {
    if (pathExistsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    if (!nearestPackageRoot && pathExistsSync(path.join(current, "package.json"))) nearestPackageRoot = current;
    const parent = path.dirname(current);
    if (parent === current) return nearestPackageRoot ?? path.resolve(start);
    current = parent;
  }
}

function pathExistsSync(filePath: string): boolean {
  return existsSync(filePath);
}

function normalizeSettings(settings: AILogSettings): AILogSettings {
  return {
    ...settings,
    claudeDirs: normalizePathList(settings.claudeDirs),
    codexDirs: normalizePathList(settings.codexDirs),
    importDirs: normalizePathList(settings.importDirs),
    scanIntervalMinutes: Number.isFinite(settings.scanIntervalMinutes) ? Math.max(1, settings.scanIntervalMinutes) : 15
  };
}

function normalizePathList(paths: string[]): string[] {
  return Array.from(new Set((paths ?? []).map((item) => item.trim()).filter(Boolean)));
}

function expandHome(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function resolveSourcePath(value: string, workspaceRoot: string): string {
  const expanded = expandHome(value);
  return path.isAbsolute(expanded) ? expanded : path.resolve(workspaceRoot, expanded);
}

function safeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").slice(0, 90) || "ailog-export";
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

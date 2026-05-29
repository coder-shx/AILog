import { existsSync } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  analyzePrompts,
  analyzeAIBehavior,
  compareConversations,
  compactConversation,
  computeCollaborationMetrics,
  computeOverviewStats,
  computeProjectInsights,
  filterConversations,
  mergeConversationState,
  redactSensitive,
  renderConversationHtml,
  renderConversationMarkdown,
  renderConversationPdf,
  scanSensitiveFindings,
  searchConversations
} from "@ailog/analyzer";
import { pathExists, scanSources } from "@ailog/parser";
import {
  defaultSettings,
  isoNow,
  stableId,
  type AILogConversation,
  type AILogIndex,
  type AILogSettings,
  type BackupManifest,
  type CapabilityStatus,
  type ConversationCompareResult,
  type ConversationFilters,
  type ExportRequest,
  type ExportResult,
  type IndexMaintenanceResult,
  type LiveSession,
  type PromptLibraryItem,
  type ProjectInsight,
  type Provider,
  type ScanResult,
  type SearchQuery,
  type SensitiveFinding,
  type TeamWorkspace
} from "@ailog/shared";
import { rebuildSqliteIndex, type SqliteIndexStatus } from "./sqlite";

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
  readonly sqlitePath: string;
  readonly promptLibraryPath: string;
  readonly liveSessionsPath: string;
  readonly teamWorkspacesPath: string;
  private readonly liveProcesses = new Map<string, ChildProcessWithoutNullStreams>();

  constructor(options: RepositoryOptions = {}) {
    this.workspaceRoot = options.workspaceRoot ?? findWorkspaceRoot(process.cwd());
    this.dataDir = options.dataDir ?? path.join(this.workspaceRoot, ".ailog");
    this.settingsPath = path.join(this.dataDir, "settings.json");
    this.indexPath = path.join(this.dataDir, "index.json");
    this.sqlitePath = path.join(this.dataDir, "index.sqlite");
    this.promptLibraryPath = path.join(this.dataDir, "prompt-library.json");
    this.liveSessionsPath = path.join(this.dataDir, "live-sessions.json");
    this.teamWorkspacesPath = path.join(this.dataDir, "team-workspaces.json");
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
    if (settings.useSQLiteIndex) await rebuildSqliteIndex(this.sqlitePath, merged);
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

  async updateConversationMeta(id: string, input: { title?: string; summary?: string }): Promise<AILogConversation | undefined> {
    const index = await this.loadIndex();
    const conversation = index.conversations.find((item) => item.id === id);
    if (!conversation) return undefined;
    if (input.title !== undefined) conversation.title = input.title.trim() || conversation.title;
    if (input.summary !== undefined) conversation.summary = input.summary.trim();
    await this.saveIndex(index.conversations);
    return conversation;
  }

  async updateMessageState(
    conversationId: string,
    messageId: string,
    input: { tags?: string[]; favorite?: boolean }
  ): Promise<AILogConversation | undefined> {
    const index = await this.loadIndex();
    const conversation = index.conversations.find((item) => item.id === conversationId);
    const message = conversation?.messages.find((item) => item.id === messageId);
    if (!conversation || !message) return undefined;
    if (input.tags) message.tags = Array.from(new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))).sort();
    if (input.favorite !== undefined) message.favorite = input.favorite;
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

  async compare(leftId: string, rightId: string): Promise<ConversationCompareResult | undefined> {
    const index = await this.loadIndex();
    const left = index.conversations.find((conversation) => conversation.id === leftId);
    const right = index.conversations.find((conversation) => conversation.id === rightId);
    return left && right ? compareConversations(left, right) : undefined;
  }

  async aiBehavior() {
    const index = await this.loadIndex();
    return analyzeAIBehavior(index.conversations);
  }

  async collaborationMetrics() {
    const index = await this.loadIndex();
    return computeCollaborationMetrics(index.conversations);
  }

  async sensitiveFindings(): Promise<SensitiveFinding[]> {
    const index = await this.loadIndex();
    return scanSensitiveFindings(index.conversations);
  }

  async sqliteStatus(): Promise<SqliteIndexStatus> {
    const index = await this.loadIndex();
    return rebuildSqliteIndex(this.sqlitePath, index.conversations);
  }

  async promptLibrary() {
    await this.ensureDataDir();
    const saved = await readJson<PromptLibraryItem[]>(this.promptLibraryPath, []);
    const index = await this.loadIndex();
    const insight = analyzePrompts(index.conversations);
    const generated = index.conversations.flatMap((conversation) =>
      conversation.messages
        .filter((message) => message.role === "user" && (message.favorite || (message.promptQuality?.total ?? 0) >= 78))
        .map((message) => ({
          id: message.id,
          conversationId: conversation.id,
          messageId: message.id,
          projectName: conversation.projectName,
          title: conversation.title ?? "Reusable prompt",
          content: message.content,
          tags: message.tags ?? [],
          score: message.promptQuality?.total ?? 0,
          intent: message.promptIntent,
          useCount: 0,
          favorite: Boolean(message.favorite),
          createdAt: message.createdAt ?? conversation.createdAt,
          updatedAt: message.createdAt ?? conversation.updatedAt
        }))
    ) satisfies PromptLibraryItem[];
    const generatedFromInsight = insight.highQualityPrompts.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      messageId: message.id,
      title: "High quality prompt",
      content: message.content,
      tags: message.tags ?? [],
      score: message.promptQuality?.total ?? 0,
      intent: message.promptIntent,
      useCount: 0,
      favorite: Boolean(message.favorite),
      createdAt: message.createdAt ?? isoNow(),
      updatedAt: message.createdAt ?? isoNow()
    })) satisfies PromptLibraryItem[];
    const byId = new Map<string, PromptLibraryItem>();
    for (const item of [...generated, ...generatedFromInsight, ...saved]) byId.set(item.id, item);
    return Array.from(byId.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 120);
  }

  async savePromptLibraryItem(input: Partial<PromptLibraryItem> & { content: string }): Promise<PromptLibraryItem> {
    await this.ensureDataDir();
    const items = await readJson<PromptLibraryItem[]>(this.promptLibraryPath, []);
    const now = isoNow();
    const item: PromptLibraryItem = {
      id: input.id ?? stableId(["prompt-library", input.content, now]),
      conversationId: input.conversationId,
      messageId: input.messageId,
      title: input.title ?? input.content.slice(0, 80),
      content: input.content,
      group: input.group,
      tags: input.tags ?? [],
      score: input.score,
      intent: input.intent,
      useCount: input.useCount ?? 0,
      favorite: input.favorite ?? true,
      createdAt: input.createdAt ?? now,
      updatedAt: now
    };
    const next = [item, ...items.filter((candidate) => candidate.id !== item.id)];
    await writeJson(this.promptLibraryPath, next);
    return item;
  }

  async listLiveSessions(): Promise<LiveSession[]> {
    await this.ensureDataDir();
    return readJson<LiveSession[]>(this.liveSessionsPath, []);
  }

  async createLiveSession(input: Partial<LiveSession> & { cwd?: string }): Promise<LiveSession> {
    await this.ensureDataDir();
    const sessions = await this.listLiveSessions();
    const now = isoNow();
    const session: LiveSession = {
      id: input.id ?? stableId(["live", input.provider, input.cwd, now]),
      provider: input.provider ?? "terminal",
      cwd: input.cwd ?? this.workspaceRoot,
      command: input.command,
      status: "created",
      transcript: input.transcript ?? [],
      createdAt: now,
      updatedAt: now
    };
    await writeJson(this.liveSessionsPath, [session, ...sessions]);
    return session;
  }

  async runLiveSession(id: string): Promise<LiveSession | undefined> {
    await this.ensureDataDir();
    const sessions = await this.listLiveSessions();
    const session = sessions.find((item) => item.id === id);
    if (!session) return undefined;
    if (!session.command?.trim()) {
      session.status = "error";
      session.transcript = [...session.transcript, "No command configured for this live session."];
      session.updatedAt = isoNow();
      await this.replaceLiveSession(session);
      return session;
    }
    if (this.liveProcesses.has(id)) return session;

    const cwd = path.isAbsolute(session.cwd) ? session.cwd : path.resolve(this.workspaceRoot, session.cwd);
    const processCwd = pathExistsSync(cwd) ? cwd : this.workspaceRoot;
    session.status = "running";
    session.transcript = [...session.transcript, `$ ${session.command}`].slice(-300);
    session.updatedAt = isoNow();
    await this.replaceLiveSession(session);

    const child = spawn(session.command, {
      cwd: processCwd,
      shell: true,
      windowsHide: true,
      env: { ...process.env, AILOG_LIVE_SESSION: "1" }
    });
    this.liveProcesses.set(id, child);

    child.stdout.on("data", (chunk: Buffer) => void this.appendLiveTranscript(id, chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => void this.appendLiveTranscript(id, chunk.toString("utf8")));
    child.on("error", (error) => {
      this.liveProcesses.delete(id);
      void this.appendLiveTranscript(id, error.message, "error");
    });
    child.on("close", (code) => {
      this.liveProcesses.delete(id);
      void this.appendLiveTranscript(id, `\n[process exited with code ${code ?? "unknown"}]`, code === 0 ? "stopped" : "error");
    });
    return session;
  }

  async stopLiveSession(id: string): Promise<LiveSession | undefined> {
    const child = this.liveProcesses.get(id);
    if (child) {
      child.kill();
      this.liveProcesses.delete(id);
    }
    const session = (await this.listLiveSessions()).find((item) => item.id === id);
    if (!session) return undefined;
    session.status = "stopped";
    session.updatedAt = isoNow();
    session.transcript = [...session.transcript, "[stopped by user]"].slice(-300);
    await this.replaceLiveSession(session);
    return session;
  }

  private async replaceLiveSession(session: LiveSession): Promise<void> {
    const sessions = await this.listLiveSessions();
    await writeJson(
      this.liveSessionsPath,
      sessions.map((item) => (item.id === session.id ? session : item))
    );
  }

  private async appendLiveTranscript(id: string, chunk: string, status?: LiveSession["status"]): Promise<void> {
    const sessions = await this.listLiveSessions();
    const session = sessions.find((item) => item.id === id);
    if (!session) return;
    const lines = chunk
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);
    session.transcript = [...session.transcript, ...lines].slice(-300);
    if (status) session.status = status;
    session.updatedAt = isoNow();
    await writeJson(
      this.liveSessionsPath,
      sessions.map((item) => (item.id === id ? session : item))
    );
  }

  async listTeamWorkspaces(): Promise<TeamWorkspace[]> {
    await this.ensureDataDir();
    return readJson<TeamWorkspace[]>(this.teamWorkspacesPath, []);
  }

  async saveTeamWorkspace(input: Partial<TeamWorkspace> & { name: string; rootPath?: string }): Promise<TeamWorkspace> {
    await this.ensureDataDir();
    const workspaces = await this.listTeamWorkspaces();
    const workspace: TeamWorkspace = {
      id: input.id ?? stableId(["team", input.name, input.rootPath ?? this.workspaceRoot]),
      name: input.name,
      rootPath: input.rootPath ?? this.workspaceRoot,
      members: input.members ?? [{ id: "local-owner", name: "Local Owner", role: "owner" }],
      sharedIndexPath: input.sharedIndexPath,
      localOnly: input.localOnly ?? true,
      createdAt: input.createdAt ?? isoNow()
    };
    await writeJson(this.teamWorkspacesPath, [workspace, ...workspaces.filter((item) => item.id !== workspace.id)]);
    return workspace;
  }

  async capabilities(): Promise<CapabilityStatus[]> {
    const settings = await this.getSettings();
    return [
      {
        id: "sqlite-index",
        name: "SQLite index",
        status: "ready",
        localFirst: true,
        description: "Mirrors the JSON index into node:sqlite tables for faster local queries.",
        entry: this.sqlitePath
      },
      {
        id: "mcp-server",
        name: "MCP server",
        status: "ready",
        localFirst: true,
        description: "Exposes AILog stats and search through a local stdio JSON-RPC MCP server.",
        entry: "packages/mcp/src/index.ts"
      },
      {
        id: "live-sessions",
        name: "Live sessions",
        status: "ready",
        localFirst: true,
        description: "Creates local session records and can run configured commands while saving transcripts.",
        entry: "apps/web/src/views/LiveSessionsView.vue"
      },
      {
        id: "pdf-export",
        name: "PDF export",
        status: "ready",
        localFirst: true,
        description: "Exports single conversations as Markdown, JSON, HTML or lightweight PDF files."
      },
      {
        id: "tauri-desktop",
        name: "Tauri desktop",
        status: "scaffolded",
        localFirst: true,
        description: "Desktop shell scaffold that points to the local Web UI.",
        entry: "apps/desktop/src-tauri/tauri.conf.json"
      },
      {
        id: "vscode-extension",
        name: "VS Code extension",
        status: "ready",
        localFirst: true,
        description: "Adds commands and a sidebar view for opening, searching and inspecting local AILog stats.",
        entry: "extensions/vscode/package.json"
      },
      {
        id: "browser-extension",
        name: "Browser extension",
        status: "ready",
        localFirst: true,
        description: "Manifest V3 helper for downloading current-page snapshots into an AILog import folder.",
        entry: "extensions/browser/manifest.json"
      },
      {
        id: "local-llm",
        name: "Local LLM analysis",
        status: settings.advancedAIAnalysis && settings.localLlmEndpoint ? "configured" : "disabled",
        localFirst: true,
        description: "Opt-in local HTTP endpoint for summaries. Only localhost endpoints are accepted."
      }
    ];
  }

  async summarizeConversation(id: string): Promise<{ id: string; summary: string; method: "heuristic" | "local-llm"; fallbackReason?: string }> {
    const conversation = await this.getConversation(id);
    if (!conversation) throw new Error(`Conversation not found: ${id}`);
    const settings = await this.getSettings();
    if (settings.advancedAIAnalysis && settings.localLlmEndpoint && isLocalHttpUrl(settings.localLlmEndpoint)) {
      try {
        const summary = await summarizeWithLocalLlm(settings, conversation);
        if (summary) return { id, method: "local-llm", summary: redactSensitive(summary).slice(0, 1400) };
      } catch (error) {
        const fallbackReason = error instanceof Error ? error.message : String(error);
        return { id, method: "heuristic", summary: buildHeuristicSummary(conversation), fallbackReason };
      }
    }
    return { id, method: "heuristic", summary: buildHeuristicSummary(conversation) };
  }

  async exportBackup(): Promise<{ manifest: BackupManifest; content: string }> {
    const settings = await this.getSettings();
    const index = await this.loadIndex();
    const library = await readJson<PromptLibraryItem[]>(this.promptLibraryPath, []);
    const manifest: BackupManifest = {
      version: 1,
      generatedAt: isoNow(),
      conversations: index.conversations.length,
      promptLibraryItems: library.length,
      settings
    };
    return { manifest, content: JSON.stringify({ manifest, index, library }, null, 2) };
  }

  async importBackup(content: string): Promise<BackupManifest> {
    await this.ensureDataDir();
    const payload = JSON.parse(content) as Partial<{ manifest: BackupManifest; index: AILogIndex; library: PromptLibraryItem[] }>;
    if (!payload.index || !Array.isArray(payload.index.conversations)) throw new Error("Invalid AILog backup: missing index.conversations");
    const settings = payload.manifest?.settings ? normalizeSettings(payload.manifest.settings) : await this.getSettings();
    await this.saveSettings(settings);
    await this.saveIndex(payload.index.conversations);
    await writeJson(this.promptLibraryPath, Array.isArray(payload.library) ? payload.library : []);
    if (settings.useSQLiteIndex) await rebuildSqliteIndex(this.sqlitePath, payload.index.conversations);
    return {
      version: payload.manifest?.version ?? 1,
      generatedAt: isoNow(),
      conversations: payload.index.conversations.length,
      promptLibraryItems: Array.isArray(payload.library) ? payload.library.length : 0,
      settings
    };
  }

  async clearIndex(): Promise<IndexMaintenanceResult> {
    await this.ensureDataDir();
    const index = await this.loadIndex();
    const library = await readJson<PromptLibraryItem[]>(this.promptLibraryPath, []);
    const sessions = await this.listLiveSessions();
    const workspaces = await this.listTeamWorkspaces();
    await this.saveIndex([]);
    await writeJson(this.promptLibraryPath, []);
    await writeJson(this.liveSessionsPath, []);
    const settings = await this.getSettings();
    let sqliteRebuilt = false;
    if (settings.useSQLiteIndex || pathExistsSync(this.sqlitePath)) {
      await rebuildSqliteIndex(this.sqlitePath, []);
      sqliteRebuilt = true;
    }
    return {
      conversations: index.conversations.length,
      promptLibraryItems: library.length,
      liveSessions: sessions.length,
      teamWorkspaces: workspaces.length,
      sqliteRebuilt
    };
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
    if (request.format === "pdf") {
      return {
        filename: `${safeFilename(conversation.title ?? conversation.id)}.pdf`,
        contentType: "application/pdf",
        content: renderConversationPdf(conversation, redact)
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
    const title = reportTitle(type);
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
      `- 高频技术词：${prompts.topTechTerms.slice(0, 12).map((item) => `${item.term}(${item.count})`).join(", ") || "N/A"}`,
      "",
      "## AI Behavior",
      "",
      ...behaviorReportLines(index.conversations),
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

function buildHeuristicSummary(conversation: AILogConversation): string {
  const prompts = conversation.messages.filter((message) => message.role === "user").slice(0, 3).map((message) => message.content);
  const replies = conversation.messages.filter((message) => message.role === "assistant").slice(-2).map((message) => message.content);
  return redactSensitive([...prompts, ...replies].join("\n\n").replace(/\s+/g, " ").slice(0, 900));
}

function reportTitle(type: string): string {
  const titles: Record<string, string> = {
    weekly: "AILog Weekly Report",
    monthly: "AILog Monthly Report",
    project: "AILog Project Report",
    prompts: "AILog Prompt Habits Report",
    compare: "AILog Claude vs Codex Report"
  };
  return titles[type] ?? "AILog Analysis Report";
}

function behaviorReportLines(conversations: AILogConversation[]): string[] {
  const behavior = analyzeAIBehavior(conversations);
  const collaboration = computeCollaborationMetrics(conversations);
  return [
    `- AI 回复总数：${behavior.assistantReplies}`,
    `- 平均回复长度：${behavior.averageReplyLength}`,
    `- 平均代码块数量：${behavior.averageCodeBlocks}`,
    `- 工具使用比例：${Math.round(behavior.toolUseRatio * 100)}%`,
    `- 主动计划比例：${Math.round(behavior.planRatio * 100)}%`,
    `- 平均每任务轮次：${collaboration.averageTurnsPerTask}`,
    `- 平均每任务工具调用：${collaboration.averageToolCallsPerTask}`,
    `- 长上下文会话比例：${Math.round(collaboration.longContextSessionRate * 100)}%`
  ];
}

async function summarizeWithLocalLlm(settings: AILogSettings, conversation: AILogConversation): Promise<string | undefined> {
  const endpoint = settings.localLlmEndpoint?.trim();
  if (!endpoint) return undefined;
  const prompt = buildSummaryPrompt(conversation);
  const isOpenAiCompatible = endpoint.includes("/chat/completions");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      isOpenAiCompatible
        ? {
            model: settings.localLlmModel || "local-model",
            messages: [
              { role: "system", content: "Summarize local AI coding conversations concisely. Do not invent facts." },
              { role: "user", content: prompt }
            ],
            temperature: 0.2
          }
        : {
            model: settings.localLlmModel || "llama3.2",
            prompt,
            stream: false
          }
    ),
    signal: AbortSignal.timeout(settings.localLlmTimeoutMs || 15000)
  });
  if (!response.ok) throw new Error(`Local LLM returned ${response.status}`);
  return extractLocalLlmText((await response.json()) as Record<string, unknown>);
}

function buildSummaryPrompt(conversation: AILogConversation): string {
  const messages = conversation.messages
    .slice(0, 40)
    .map((message) => `${message.role}: ${redactSensitive(message.content).replace(/\s+/g, " ").slice(0, 900)}`)
    .join("\n");
  return [
    "请为下面的 AI 编程协作会话生成本地摘要。",
    "请输出：任务目标、关键决策、涉及文件或工具、错误/重试、可复用经验。",
    "",
    `标题：${conversation.title ?? conversation.id}`,
    `项目：${conversation.projectName ?? "Unknown"}`,
    messages
  ].join("\n");
}

function extractLocalLlmText(data: Record<string, unknown>): string | undefined {
  if (typeof data.response === "string") return data.response;
  if (typeof data.output === "string") return data.output;
  const choices = Array.isArray(data.choices) ? data.choices : [];
  for (const choice of choices) {
    const record = choice && typeof choice === "object" ? (choice as Record<string, unknown>) : {};
    const message = record.message && typeof record.message === "object" ? (record.message as Record<string, unknown>) : {};
    if (typeof message.content === "string") return message.content;
    if (typeof record.text === "string") return record.text;
  }
  return undefined;
}

function isLocalHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname.endsWith(".localhost"))
    );
  } catch {
    return false;
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
    scanIntervalMinutes: Number.isFinite(settings.scanIntervalMinutes) ? Math.max(1, settings.scanIntervalMinutes) : 15,
    localLlmEndpoint: settings.localLlmEndpoint?.trim() ?? "",
    localLlmModel: settings.localLlmModel?.trim() || "llama3.2",
    localLlmTimeoutMs: Number.isFinite(settings.localLlmTimeoutMs) ? Math.max(1000, settings.localLlmTimeoutMs) : 15000
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

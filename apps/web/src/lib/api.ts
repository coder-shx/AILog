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
  PromptLibraryItem,
  ProjectInsight,
  PromptInsight,
  ScanResult,
  SearchQuery,
  SearchResult,
  SensitiveFinding,
  TeamWorkspace
} from "@ailog/shared";
import {
  demoAiBehavior,
  demoBackup,
  demoCapabilities,
  demoCollaboration,
  demoCompare,
  demoConversation,
  demoExport,
  demoLiveSessions,
  demoMaintenance,
  demoOverview,
  demoProjects,
  demoPromptInsight,
  demoPromptLibrary,
  demoSearch,
  demoSensitiveFindings,
  demoSettings,
  demoTeamWorkspaces,
  filterDemoConversations
} from "@/lib/demo";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:1421";
const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === "true";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export const client = {
  health: () => (STATIC_DEMO ? Promise.resolve({ ok: true, dataDir: "github-pages-demo" }) : api<{ ok: boolean; dataDir: string }>("/api/health")),
  settings: () => (STATIC_DEMO ? Promise.resolve(demoSettings) : api<AILogSettings>("/api/settings")),
  saveSettings: (settings: AILogSettings) => (STATIC_DEMO ? Promise.resolve(settings) : api<AILogSettings>("/api/settings", { method: "POST", body: JSON.stringify(settings) })),
  scan: () =>
    STATIC_DEMO
      ? Promise.resolve({ result: { scannedFiles: 1, skippedFiles: 0, conversations: 1, errors: [], startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() }, conversations: filterDemoConversations() })
      : api<{ result: ScanResult; conversations: AILogConversation[] }>("/api/scan", { method: "POST", body: JSON.stringify({}) }),
  conversations: (filters: ConversationFilters = {}) => (STATIC_DEMO ? Promise.resolve(filterDemoConversations(filters)) : api<AILogConversation[]>(`/api/conversations${toQuery(filters)}`)),
  conversation: (id: string) => (STATIC_DEMO ? Promise.resolve(id === demoConversation.id ? demoConversation : demoConversation) : api<AILogConversation>(`/api/conversations/${encodeURIComponent(id)}`)),
  messages: (id: string) => (STATIC_DEMO ? Promise.resolve(demoConversation.messages) : api<AILogMessage[]>(`/api/conversations/${encodeURIComponent(id)}/messages`)),
  tags: (id: string, tags: string[]) => (STATIC_DEMO ? Promise.resolve({ ...demoConversation, tags }) : api<AILogConversation>(`/api/conversations/${encodeURIComponent(id)}/tags`, { method: "POST", body: JSON.stringify({ tags }) })),
  favorite: (id: string, favorite: boolean) =>
    STATIC_DEMO ? Promise.resolve({ ...demoConversation, favorite }) : api<AILogConversation>(`/api/conversations/${encodeURIComponent(id)}/favorite`, { method: "POST", body: JSON.stringify({ favorite }) }),
  updateConversation: (id: string, input: { title?: string; summary?: string }) =>
    STATIC_DEMO ? Promise.resolve({ ...demoConversation, ...input }) : api<AILogConversation>(`/api/conversations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  updateMessageState: (conversationId: string, messageId: string, input: { tags?: string[]; favorite?: boolean }) =>
    STATIC_DEMO
      ? Promise.resolve({
          ...demoConversation,
          messages: demoConversation.messages.map((message) => (message.id === messageId ? { ...message, ...input } : message))
        })
      : api<AILogConversation>(`/api/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/state`, {
          method: "POST",
          body: JSON.stringify(input)
        }),
  search: (query: SearchQuery) => (STATIC_DEMO ? Promise.resolve(demoSearch(query)) : api<SearchResult[]>(`/api/search${toQuery(query)}`)),
  overview: () => (STATIC_DEMO ? Promise.resolve(demoOverview) : api<OverviewStats>("/api/stats/overview")),
  promptInsight: () => (STATIC_DEMO ? Promise.resolve(demoPromptInsight) : api<PromptInsight>("/api/stats/prompts")),
  aiBehavior: () => (STATIC_DEMO ? Promise.resolve(demoAiBehavior) : api<AIBehaviorInsight>("/api/stats/ai-behavior")),
  collaboration: () => (STATIC_DEMO ? Promise.resolve(demoCollaboration) : api<CollaborationMetrics>("/api/stats/collaboration")),
  projects: () => (STATIC_DEMO ? Promise.resolve(demoProjects) : api<ProjectInsight[]>("/api/stats/projects")),
  compare: (leftId: string, rightId: string) => (STATIC_DEMO ? Promise.resolve(demoCompare()) : api<ConversationCompareResult>(`/api/compare${toQuery({ leftId, rightId })}`)),
  sensitive: () => (STATIC_DEMO ? Promise.resolve(demoSensitiveFindings) : api<SensitiveFinding[]>("/api/privacy/sensitive")),
  sqliteStatus: () => (STATIC_DEMO ? Promise.resolve({ available: false, mode: "static-demo" }) : api<Record<string, unknown>>("/api/sqlite/status")),
  capabilities: () => (STATIC_DEMO ? Promise.resolve(demoCapabilities) : api<CapabilityStatus[]>("/api/capabilities")),
  prompts: () =>
    STATIC_DEMO
      ? Promise.resolve(demoConversation.messages.filter((message) => message.role === "user").map((message) => ({ ...message, conversationTitle: demoConversation.title, projectName: demoConversation.projectName })))
      : api<Array<AILogMessage & { conversationTitle?: string; projectName?: string }>>("/api/prompts"),
  promptLibrary: () => (STATIC_DEMO ? Promise.resolve(demoPromptLibrary) : api<PromptLibraryItem[]>("/api/prompt-library")),
  savePromptLibrary: (item: { title?: string; content: string; tags?: string[]; group?: string }) =>
    STATIC_DEMO
      ? Promise.resolve({ ...demoPromptLibrary[0], ...item, id: "demo-library-added", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      : api<PromptLibraryItem>("/api/prompt-library", { method: "POST", body: JSON.stringify(item) }),
  exportConversation: (id: string, request: ExportRequest) =>
    STATIC_DEMO ? Promise.resolve(demoExport(request.format)) : api<ExportResult>(`/api/export/conversation/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify(request) }),
  exportReport: (type: string) =>
    STATIC_DEMO
      ? Promise.resolve({ filename: `ailog-${type}-demo.md`, contentType: "text/markdown", content: `# AILog ${type} demo report\n\nOpen the local app to generate reports from private data.` })
      : api<ExportResult>("/api/export/report", { method: "POST", body: JSON.stringify({ type, redact: true }) }),
  backup: () => (STATIC_DEMO ? Promise.resolve(demoBackup) : api<{ manifest: BackupManifest; content: string }>("/api/export/backup", { method: "POST", body: JSON.stringify({}) })),
  restoreBackup: (content: string) => (STATIC_DEMO ? Promise.resolve({ ...demoBackup.manifest, promptLibraryItems: content.length ? 1 : 0 }) : api<BackupManifest>("/api/export/restore", { method: "POST", body: JSON.stringify({ content }) })),
  clearIndex: () => (STATIC_DEMO ? Promise.resolve(demoMaintenance) : api<IndexMaintenanceResult>("/api/admin/clear-index", { method: "POST", body: JSON.stringify({}) })),
  liveSessions: () => (STATIC_DEMO ? Promise.resolve(demoLiveSessions) : api<LiveSession[]>("/api/live-sessions")),
  createLiveSession: (session: { cwd?: string; provider?: LiveSession["provider"]; command?: string }) =>
    STATIC_DEMO
      ? Promise.resolve({ id: "demo-live", provider: session.provider ?? "terminal", cwd: session.cwd ?? "/workspace/AILog", command: session.command, status: "created", transcript: ["Static demo mode: run the local app to execute commands."], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      : api<LiveSession>("/api/live-sessions", { method: "POST", body: JSON.stringify(session) }),
  runLiveSession: (id: string) =>
    STATIC_DEMO
      ? Promise.resolve({ id, provider: "terminal", cwd: "/workspace/AILog", command: "echo demo", status: "stopped", transcript: ["$ echo demo", "Static demo mode"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      : api<LiveSession>(`/api/live-sessions/${encodeURIComponent(id)}/run`, { method: "POST", body: JSON.stringify({}) }),
  stopLiveSession: (id: string) =>
    STATIC_DEMO
      ? Promise.resolve({ id, provider: "terminal", cwd: "/workspace/AILog", status: "stopped", transcript: ["Static demo stopped."], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      : api<LiveSession>(`/api/live-sessions/${encodeURIComponent(id)}/stop`, { method: "POST", body: JSON.stringify({}) }),
  teamWorkspaces: () => (STATIC_DEMO ? Promise.resolve(demoTeamWorkspaces) : api<TeamWorkspace[]>("/api/team/workspaces")),
  saveTeamWorkspace: (workspace: { name: string; rootPath?: string }) =>
    STATIC_DEMO
      ? Promise.resolve({ id: "demo-team", name: workspace.name, rootPath: workspace.rootPath ?? "/workspace/AILog", members: [{ id: "demo", name: "Demo", role: "owner" }], localOnly: true, createdAt: new Date().toISOString() })
      : api<TeamWorkspace>("/api/team/workspaces", { method: "POST", body: JSON.stringify(workspace) }),
  summarize: (id: string) =>
    STATIC_DEMO
      ? Promise.resolve({ id, summary: "Static demo summary. Run AILog locally to summarize private conversations.", method: "heuristic" })
      : api<{ id: string; summary: string; method: string }>(`/api/conversations/${encodeURIComponent(id)}/summary`, { method: "POST", body: JSON.stringify({}) })
};

function toQuery(value: object): string {
  const params = new URLSearchParams();
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === undefined || item === null || item === "") continue;
    params.set(key, String(item));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

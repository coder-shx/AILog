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

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:1421";

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
  health: () => api<{ ok: boolean; dataDir: string }>("/api/health"),
  settings: () => api<AILogSettings>("/api/settings"),
  saveSettings: (settings: AILogSettings) => api<AILogSettings>("/api/settings", { method: "POST", body: JSON.stringify(settings) }),
  scan: () => api<{ result: ScanResult; conversations: AILogConversation[] }>("/api/scan", { method: "POST", body: JSON.stringify({}) }),
  conversations: (filters: ConversationFilters = {}) => api<AILogConversation[]>(`/api/conversations${toQuery(filters)}`),
  conversation: (id: string) => api<AILogConversation>(`/api/conversations/${encodeURIComponent(id)}`),
  messages: (id: string) => api<AILogMessage[]>(`/api/conversations/${encodeURIComponent(id)}/messages`),
  tags: (id: string, tags: string[]) => api<AILogConversation>(`/api/conversations/${encodeURIComponent(id)}/tags`, { method: "POST", body: JSON.stringify({ tags }) }),
  favorite: (id: string, favorite: boolean) => api<AILogConversation>(`/api/conversations/${encodeURIComponent(id)}/favorite`, { method: "POST", body: JSON.stringify({ favorite }) }),
  updateConversation: (id: string, input: { title?: string; summary?: string }) =>
    api<AILogConversation>(`/api/conversations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  updateMessageState: (conversationId: string, messageId: string, input: { tags?: string[]; favorite?: boolean }) =>
    api<AILogConversation>(`/api/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/state`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  search: (query: SearchQuery) => api<SearchResult[]>(`/api/search${toQuery(query)}`),
  overview: () => api<OverviewStats>("/api/stats/overview"),
  promptInsight: () => api<PromptInsight>("/api/stats/prompts"),
  aiBehavior: () => api<AIBehaviorInsight>("/api/stats/ai-behavior"),
  collaboration: () => api<CollaborationMetrics>("/api/stats/collaboration"),
  projects: () => api<ProjectInsight[]>("/api/stats/projects"),
  compare: (leftId: string, rightId: string) => api<ConversationCompareResult>(`/api/compare${toQuery({ leftId, rightId })}`),
  sensitive: () => api<SensitiveFinding[]>("/api/privacy/sensitive"),
  sqliteStatus: () => api<Record<string, unknown>>("/api/sqlite/status"),
  capabilities: () => api<CapabilityStatus[]>("/api/capabilities"),
  prompts: () => api<Array<AILogMessage & { conversationTitle?: string; projectName?: string }>>("/api/prompts"),
  promptLibrary: () => api<PromptLibraryItem[]>("/api/prompt-library"),
  savePromptLibrary: (item: { title?: string; content: string; tags?: string[]; group?: string }) =>
    api<PromptLibraryItem>("/api/prompt-library", { method: "POST", body: JSON.stringify(item) }),
  exportConversation: (id: string, request: ExportRequest) =>
    api<ExportResult>(`/api/export/conversation/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify(request) }),
  exportReport: (type: string) => api<ExportResult>("/api/export/report", { method: "POST", body: JSON.stringify({ type, redact: true }) }),
  backup: () => api<{ manifest: BackupManifest; content: string }>("/api/export/backup", { method: "POST", body: JSON.stringify({}) }),
  restoreBackup: (content: string) => api<BackupManifest>("/api/export/restore", { method: "POST", body: JSON.stringify({ content }) }),
  clearIndex: () => api<IndexMaintenanceResult>("/api/admin/clear-index", { method: "POST", body: JSON.stringify({}) }),
  liveSessions: () => api<LiveSession[]>("/api/live-sessions"),
  createLiveSession: (session: { cwd?: string; provider?: LiveSession["provider"]; command?: string }) =>
    api<LiveSession>("/api/live-sessions", { method: "POST", body: JSON.stringify(session) }),
  runLiveSession: (id: string) => api<LiveSession>(`/api/live-sessions/${encodeURIComponent(id)}/run`, { method: "POST", body: JSON.stringify({}) }),
  stopLiveSession: (id: string) => api<LiveSession>(`/api/live-sessions/${encodeURIComponent(id)}/stop`, { method: "POST", body: JSON.stringify({}) }),
  teamWorkspaces: () => api<TeamWorkspace[]>("/api/team/workspaces"),
  saveTeamWorkspace: (workspace: { name: string; rootPath?: string }) =>
    api<TeamWorkspace>("/api/team/workspaces", { method: "POST", body: JSON.stringify(workspace) }),
  summarize: (id: string) => api<{ id: string; summary: string; method: string }>(`/api/conversations/${encodeURIComponent(id)}/summary`, { method: "POST", body: JSON.stringify({}) })
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

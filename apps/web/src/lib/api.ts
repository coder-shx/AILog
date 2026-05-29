import type {
  AILogConversation,
  AILogMessage,
  AILogSettings,
  ConversationFilters,
  ExportRequest,
  ExportResult,
  OverviewStats,
  ProjectInsight,
  PromptInsight,
  ScanResult,
  SearchQuery,
  SearchResult
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
  search: (query: SearchQuery) => api<SearchResult[]>(`/api/search${toQuery(query)}`),
  overview: () => api<OverviewStats>("/api/stats/overview"),
  promptInsight: () => api<PromptInsight>("/api/stats/prompts"),
  projects: () => api<ProjectInsight[]>("/api/stats/projects"),
  prompts: () => api<Array<AILogMessage & { conversationTitle?: string; projectName?: string }>>("/api/prompts"),
  promptLibrary: () => api<Array<Record<string, unknown>>>("/api/prompt-library"),
  exportConversation: (id: string, request: ExportRequest) =>
    api<ExportResult>(`/api/export/conversation/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify(request) }),
  exportReport: (type: string) => api<ExportResult>("/api/export/report", { method: "POST", body: JSON.stringify({ type, redact: true }) })
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

import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { AILogRepository } from "@ailog/core";
import type { AILogSettings, ConversationFilters, ExportRequest, Provider, SearchQuery } from "@ailog/shared";

export interface BuildAppOptions {
  repository?: AILogRepository;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const repository = options.repository ?? new AILogRepository();
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/api/health", async () => ({
    ok: true,
    name: "AILog",
    version: "0.1.0",
    dataDir: repository.dataDir
  }));

  app.get("/api/settings", async () => repository.getSettings());

  app.post("/api/settings", async (request) => {
    return repository.saveSettings(request.body as AILogSettings);
  });

  app.post("/api/scan", async (request) => {
    const body = (request.body ?? {}) as { roots?: Array<{ path: string; provider?: Provider; projectName?: string }> };
    return repository.scan({ roots: body.roots });
  });

  app.get("/api/projects", async () => repository.projectInsights());

  app.get("/api/conversations", async (request) => {
    const filters = queryToConversationFilters(request.query as Record<string, string | undefined>);
    return repository.listConversations(filters, false);
  });

  app.get("/api/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversation = await repository.getConversation(id);
    if (!conversation) return reply.code(404).send({ message: "Conversation not found" });
    return conversation;
  });

  app.get("/api/conversations/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversation = await repository.getConversation(id);
    if (!conversation) return reply.code(404).send({ message: "Conversation not found" });
    return conversation.messages;
  });

  app.post("/api/conversations/:id/tags", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { tags?: string[] };
    const conversation = await repository.updateConversationTags(id, body.tags ?? []);
    if (!conversation) return reply.code(404).send({ message: "Conversation not found" });
    return conversation;
  });

  app.post("/api/conversations/:id/favorite", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { favorite?: boolean };
    const conversation = await repository.setConversationFavorite(id, Boolean(body.favorite));
    if (!conversation) return reply.code(404).send({ message: "Conversation not found" });
    return conversation;
  });

  app.get("/api/search", async (request) => {
    return repository.search(queryToSearchQuery(request.query as Record<string, string | undefined>));
  });

  app.get("/api/stats/overview", async () => repository.overview());
  app.get("/api/stats/prompts", async () => repository.promptInsight());
  app.get("/api/stats/tools", async () => {
    const overview = await repository.overview();
    return { toolCounts: overview.toolCounts, failedToolCounts: overview.failedToolCounts, totalToolCalls: overview.totalToolCalls };
  });
  app.get("/api/stats/models", async () => {
    const overview = await repository.overview();
    return { modelCounts: overview.modelCounts, topModel: overview.topModel };
  });
  app.get("/api/stats/projects", async () => repository.projectInsights());
  app.get("/api/stats/timeline", async () => repository.listConversations({ sort: "newest" }, false));

  app.get("/api/prompts", async () => {
    const conversations = await repository.listConversations({}, true);
    return conversations.flatMap((conversation) =>
      conversation.messages
        .filter((message) => message.role === "user")
        .map((message) => ({
          ...message,
          conversationTitle: conversation.title,
          projectName: conversation.projectName,
          provider: conversation.provider
        }))
    );
  });

  app.get("/api/prompts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversations = await repository.listConversations({}, true);
    for (const conversation of conversations) {
      const prompt = conversation.messages.find((message) => message.id === id && message.role === "user");
      if (prompt) return { ...prompt, conversationTitle: conversation.title, projectName: conversation.projectName, provider: conversation.provider };
    }
    return reply.code(404).send({ message: "Prompt not found" });
  });

  app.post("/api/prompts/:id/favorite", async (request, reply) => {
    const { id } = request.params as { id: string };
    const index = await repository.loadIndex();
    const body = (request.body ?? {}) as { favorite?: boolean };
    for (const conversation of index.conversations) {
      const prompt = conversation.messages.find((message) => message.id === id && message.role === "user");
      if (!prompt) continue;
      prompt.favorite = Boolean(body.favorite);
      await repository.saveIndex(index.conversations);
      return prompt;
    }
    return reply.code(404).send({ message: "Prompt not found" });
  });

  app.get("/api/prompt-library", async () => repository.promptLibrary());

  app.post("/api/prompt-library", async (request) => {
    return {
      saved: true,
      item: request.body
    };
  });

  app.post("/api/export/conversation/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await repository.exportConversation(id, (request.body ?? { format: "markdown" }) as ExportRequest);
    if (!result) return reply.code(404).send({ message: "Conversation not found" });
    return result;
  });

  app.post("/api/export/report", async (request) => {
    const body = (request.body ?? {}) as { type?: string; redact?: boolean };
    return repository.exportReport(body.type ?? "weekly", body.redact ?? true);
  });

  app.get("/api/doctor", async () => repository.doctor());

  return app;
}

function queryToConversationFilters(query: Record<string, string | undefined>): ConversationFilters {
  return {
    provider: asProvider(query.provider),
    projectName: query.projectName,
    model: query.model,
    tag: query.tag,
    keyword: query.keyword,
    hasToolCalls: asBoolean(query.hasToolCalls),
    hasErrors: asBoolean(query.hasErrors),
    hasShell: asBoolean(query.hasShell),
    from: query.from,
    to: query.to,
    minTokens: asNumber(query.minTokens),
    maxTokens: asNumber(query.maxTokens),
    intent: query.intent as ConversationFilters["intent"],
    sort: query.sort as ConversationFilters["sort"]
  };
}

function queryToSearchQuery(query: Record<string, string | undefined>): SearchQuery {
  return {
    q: query.q ?? "",
    provider: asProvider(query.provider),
    projectName: query.projectName,
    role: query.role as SearchQuery["role"],
    from: query.from,
    to: query.to,
    regex: asBoolean(query.regex),
    caseSensitive: asBoolean(query.caseSensitive),
    limit: asNumber(query.limit)
  };
}

function asProvider(value: string | undefined): Provider | undefined {
  const providers: Provider[] = ["claude-code", "codex-cli", "openai", "anthropic", "gemini", "unknown"];
  return providers.includes(value as Provider) ? (value as Provider) : undefined;
}

function asBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === "true" || value === "1";
}

function asNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

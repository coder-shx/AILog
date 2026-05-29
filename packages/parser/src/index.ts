import { constants } from "node:fs";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  enrichConversation,
  recomputeConversationStats,
  toolTypeFromName
} from "@ailog/analyzer";
import {
  SUPPORTED_EXTENSIONS,
  normalizeDate,
  stableId,
  truncate,
  type AILogConversation,
  type AILogMessage,
  type AILogToolCall,
  type Provider,
  type ScanResult,
  type TokenUsage
} from "@ailog/shared";

export interface ParseContext {
  provider?: Provider;
  projectName?: string;
  projectPath?: string;
}

export interface ParserAdapter {
  name: string;
  canParse(filePath: string, content: string, context?: ParseContext): boolean;
  parse(filePath: string, content: string, context?: ParseContext): AILogConversation[];
}

export interface DiscoverOptions {
  maxDepth?: number;
  maxFileSizeBytes?: number;
  extensions?: Set<string>;
}

export interface ScanOptions extends DiscoverOptions {
  roots: Array<{ path: string; provider?: Provider; projectName?: string }>;
  adapters?: ParserAdapter[];
}

const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_FILE_SIZE = 12 * 1024 * 1024;

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function discoverFiles(root: string, options: DiscoverOptions = {}): Promise<string[]> {
  const files: string[] = [];
  const extensions = options.extensions ?? SUPPORTED_EXTENSIONS;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
  const resolvedRoot = path.resolve(root);
  try {
    const rootStat = await stat(resolvedRoot);
    if (rootStat.isFile()) {
      const extension = path.extname(resolvedRoot).toLowerCase();
      return extensions.has(extension) && rootStat.size <= maxFileSizeBytes ? [resolvedRoot] : [];
    }
  } catch {
    return [];
  }

  async function walk(current: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
        await walk(entryPath, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (!extensions.has(extension)) continue;
      try {
        const fileStat = await stat(entryPath);
        if (fileStat.size <= maxFileSizeBytes) files.push(entryPath);
      } catch {
        continue;
      }
    }
  }

  await walk(resolvedRoot, 0);
  return files.sort();
}

export async function scanSources(options: ScanOptions): Promise<{ result: ScanResult; conversations: AILogConversation[] }> {
  const startedAt = new Date().toISOString();
  const adapters = options.adapters ?? defaultAdapters();
  const conversations: AILogConversation[] = [];
  const errors: ScanResult["errors"] = [];
  let scannedFiles = 0;
  let skippedFiles = 0;

  for (const root of options.roots) {
    if (!(await pathExists(root.path))) {
      errors.push({ filePath: root.path, message: "Path is not readable" });
      continue;
    }
    const files = await discoverFiles(root.path, options);
    for (const filePath of files) {
      let content = "";
      try {
        content = await readFile(filePath, "utf8");
      } catch (error) {
        skippedFiles += 1;
        errors.push({ filePath, message: error instanceof Error ? error.message : "Failed to read file" });
        continue;
      }

      const context: ParseContext = {
        provider: root.provider ?? inferProviderFromPath(filePath),
        projectName: root.projectName,
        projectPath: root.path
      };
      const adapter = adapters.find((candidate) => candidate.canParse(filePath, content, context));
      if (!adapter) {
        skippedFiles += 1;
        continue;
      }
      try {
        const parsed = adapter.parse(filePath, content, context).map((conversation) => enrichConversation(recomputeConversationStats(conversation)));
        conversations.push(...parsed);
        scannedFiles += 1;
      } catch (error) {
        skippedFiles += 1;
        errors.push({ filePath, message: error instanceof Error ? error.message : "Failed to parse file" });
      }
    }
  }

  return {
    result: {
      scannedFiles,
      skippedFiles,
      conversations: conversations.length,
      errors,
      startedAt,
      finishedAt: new Date().toISOString()
    },
    conversations: dedupeConversations(conversations)
  };
}

export function defaultAdapters(): ParserAdapter[] {
  return [new ClaudeJsonlAdapter(), new GenericJsonlAdapter(), new GenericJsonAdapter(), new MarkdownTextAdapter()];
}

export class ClaudeJsonlAdapter implements ParserAdapter {
  name = "claude-jsonl";

  canParse(filePath: string, content: string, context?: ParseContext): boolean {
    if (path.extname(filePath).toLowerCase() !== ".jsonl") return false;
    if (context?.provider === "claude-code") return true;
    return /"sessionId"|"parentUuid"|"tool_use"|"tool_result"|"cwd"/.test(content.slice(0, 8000)) && filePath.toLowerCase().includes(".claude");
  }

  parse(filePath: string, content: string, context?: ParseContext): AILogConversation[] {
    const rows = parseJsonLines(content);
    const groups = new Map<string, unknown[]>();
    for (const row of rows) {
      const record = asRecord(row);
      const sessionId = stringValue(record.sessionId) ?? stringValue(record.session_id) ?? stringValue(record.conversationId) ?? filePath;
      const group = groups.get(sessionId) ?? [];
      group.push(row);
      groups.set(sessionId, group);
    }

    return Array.from(groups.entries()).map(([sessionId, group]) => {
      const messages = group
        .map((item, index) => claudeRowToMessage(filePath, sessionId, item, index))
        .filter((message): message is AILogMessage => Boolean(message));
      const firstRecord = asRecord(group[0]);
      const cwd = stringValue(firstRecord.cwd) ?? stringValue(firstRecord.projectPath) ?? context?.projectPath;
      const projectName = context?.projectName ?? deriveProjectName(cwd ?? filePath);
      const conversation: AILogConversation = {
        id: stableId(["claude-code", sessionId, filePath]),
        provider: "claude-code",
        projectName,
        projectPath: cwd,
        title: deriveConversationTitle(messages, sessionId),
        createdAt: messages[0]?.createdAt ?? normalizeDate(firstRecord.timestamp),
        updatedAt: messages.at(-1)?.createdAt ?? normalizeDate(firstRecord.timestamp),
        modelNames: [],
        messageCount: 0,
        userMessageCount: 0,
        assistantMessageCount: 0,
        toolCallCount: 0,
        tags: [],
        sourceFilePath: filePath,
        messages,
        metadata: { sessionId, parser: this.name }
      };
      return conversation;
    });
  }
}

export class GenericJsonlAdapter implements ParserAdapter {
  name = "generic-jsonl";

  canParse(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === ".jsonl";
  }

  parse(filePath: string, content: string, context?: ParseContext): AILogConversation[] {
    const rows = parseJsonLines(content);
    if (!rows.length) return [];
    const provider = context?.provider ?? inferProviderFromContent(content);
    const groups = new Map<string, unknown[]>();
    for (const row of rows) {
      const record = asRecord(row);
      const sessionId =
        stringValue(record.sessionId) ??
        stringValue(record.session_id) ??
        stringValue(record.conversation_id) ??
        stringValue(record.thread_id) ??
        filePath;
      const group = groups.get(sessionId) ?? [];
      group.push(row);
      groups.set(sessionId, group);
    }
    return Array.from(groups.entries()).map(([sessionId, group]) => buildConversationFromRows(filePath, provider, sessionId, group, context, this.name));
  }
}

export class GenericJsonAdapter implements ParserAdapter {
  name = "generic-json";

  canParse(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === ".json";
  }

  parse(filePath: string, content: string, context?: ParseContext): AILogConversation[] {
    const data = JSON.parse(content) as unknown;
    const provider = context?.provider ?? inferProviderFromContent(content);
    if (Array.isArray(data)) {
      if (data.every((item) => Array.isArray(asRecord(item).messages) || Array.isArray(asRecord(item).mapping))) {
        return data.map((item, index) => buildConversationFromObject(filePath, provider, item, context, `${index}`, this.name));
      }
      return [buildConversationFromRows(filePath, provider, stableId([filePath]), data, context, this.name)];
    }
    return [buildConversationFromObject(filePath, provider, data, context, stableId([filePath]), this.name)];
  }
}

export class MarkdownTextAdapter implements ParserAdapter {
  name = "markdown-text";

  canParse(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return [".md", ".markdown", ".txt", ".log"].includes(extension);
  }

  parse(filePath: string, content: string, context?: ParseContext): AILogConversation[] {
    const provider = context?.provider ?? inferProviderFromPath(filePath);
    const conversationId = stableId([provider, filePath]);
    const messages = splitTextMessages(content, conversationId, filePath);
    const createdAt = normalizeDate(undefined);
    return [
      {
        id: conversationId,
        provider,
        projectName: context?.projectName ?? deriveProjectName(filePath),
        projectPath: context?.projectPath,
        title: deriveConversationTitle(messages, path.basename(filePath)),
        createdAt,
        updatedAt: createdAt,
        modelNames: [],
        messageCount: 0,
        userMessageCount: 0,
        assistantMessageCount: 0,
        toolCallCount: 0,
        tags: [],
        sourceFilePath: filePath,
        messages,
        metadata: { parser: this.name }
      }
    ];
  }
}

function claudeRowToMessage(filePath: string, conversationId: string, item: unknown, index: number): AILogMessage | undefined {
  const record = asRecord(item);
  const messageRecord = asRecord(record.message);
  const type = stringValue(record.type) ?? stringValue(record.role) ?? stringValue(messageRecord.role);
  const role = normalizeRole(stringValue(messageRecord.role) ?? type);
  const contentValue = messageRecord.content ?? record.content ?? record.text;
  const content = extractContent(contentValue);
  const toolCalls = extractToolCalls(contentValue, record.tool_calls ?? messageRecord.tool_calls);
  const createdAt = normalizeDate(record.timestamp ?? record.created_at ?? record.createdAt, undefined);
  const model = stringValue(messageRecord.model) ?? stringValue(record.model);
  const tokenUsage = extractTokenUsage(messageRecord.usage ?? record.usage ?? record.tokenUsage);

  if (!content && !toolCalls.length && !type) return undefined;
  return {
    id: stableId([filePath, conversationId, index, role, createdAt, content.slice(0, 80)]),
    conversationId: stableId(["claude-code", conversationId, filePath]),
    role,
    providerRole: type,
    content: content || summarizeToolCalls(toolCalls),
    rawContent: item,
    createdAt,
    model,
    tokenUsage,
    toolCalls,
    metadata: {
      uuid: stringValue(record.uuid),
      parentUuid: stringValue(record.parentUuid),
      cwd: stringValue(record.cwd)
    }
  };
}

function buildConversationFromRows(
  filePath: string,
  provider: Provider,
  sessionId: string,
  rows: unknown[],
  context: ParseContext | undefined,
  parser: string
): AILogConversation {
  const conversationId = stableId([provider, sessionId, filePath]);
  const messages = rows
    .map((row, index) => genericRowToMessage(filePath, conversationId, row, index))
    .filter((message): message is AILogMessage => Boolean(message));
  return {
    id: conversationId,
    provider,
    projectName: context?.projectName ?? deriveProjectName(context?.projectPath ?? filePath),
    projectPath: context?.projectPath,
    title: deriveConversationTitle(messages, sessionId),
    createdAt: messages[0]?.createdAt ?? normalizeDate(undefined),
    updatedAt: messages.at(-1)?.createdAt ?? normalizeDate(undefined),
    modelNames: [],
    messageCount: 0,
    userMessageCount: 0,
    assistantMessageCount: 0,
    toolCallCount: 0,
    tags: [],
    sourceFilePath: filePath,
    messages,
    metadata: { sessionId, parser }
  };
}

function buildConversationFromObject(
  filePath: string,
  provider: Provider,
  data: unknown,
  context: ParseContext | undefined,
  suffix: string,
  parser: string
): AILogConversation {
  const record = asRecord(data);
  const id = stringValue(record.id) ?? stringValue(record.conversation_id) ?? stableId([provider, filePath, suffix]);
  const rawMessages = extractRawMessages(record);
  const messages = rawMessages
    .map((message, index) => genericRowToMessage(filePath, id, message, index))
    .filter((message): message is AILogMessage => Boolean(message));
  const createdAt = normalizeDate(record.created_at ?? record.createdAt ?? record.create_time ?? messages[0]?.createdAt);
  const updatedAt = normalizeDate(record.updated_at ?? record.updatedAt ?? record.update_time ?? messages.at(-1)?.createdAt, createdAt);

  return {
    id,
    provider,
    projectName: context?.projectName ?? stringValue(record.projectName) ?? stringValue(record.project_name) ?? deriveProjectName(context?.projectPath ?? filePath),
    projectPath: context?.projectPath ?? stringValue(record.projectPath) ?? stringValue(record.cwd),
    title: stringValue(record.title) ?? deriveConversationTitle(messages, path.basename(filePath)),
    summary: stringValue(record.summary),
    createdAt,
    updatedAt,
    modelNames: [],
    messageCount: 0,
    userMessageCount: 0,
    assistantMessageCount: 0,
    toolCallCount: 0,
    tokenUsage: extractTokenUsage(record.usage ?? record.tokenUsage),
    tags: arrayOfStrings(record.tags),
    sourceFilePath: filePath,
    messages,
    metadata: { parser }
  };
}

function genericRowToMessage(filePath: string, conversationId: string, row: unknown, index: number): AILogMessage | undefined {
  const record = asRecord(row);
  const messageRecord = asRecord(record.message);
  const role = normalizeRole(
    stringValue(record.role) ??
      stringValue(record.type) ??
      stringValue(record.author) ??
      stringValue(messageRecord.role) ??
      stringValue(messageRecord.type)
  );
  const contentValue =
    record.content ??
    record.text ??
    record.output ??
    record.input ??
    messageRecord.content ??
    messageRecord.text ??
    asRecord(record.delta).content;
  const content = extractContent(contentValue);
  const toolCalls = extractToolCalls(contentValue, record.tool_calls ?? record.toolCalls ?? messageRecord.tool_calls ?? messageRecord.toolCalls);
  const createdAt = normalizeDate(
    record.timestamp ?? record.created_at ?? record.createdAt ?? record.time ?? record.date ?? messageRecord.created_at,
    undefined
  );
  const model = stringValue(record.model) ?? stringValue(messageRecord.model);
  const tokenUsage = extractTokenUsage(record.usage ?? record.tokenUsage ?? messageRecord.usage);
  if (!content && !toolCalls.length) return undefined;
  return {
    id: stableId([filePath, conversationId, index, role, createdAt, content.slice(0, 80)]),
    conversationId,
    role,
    providerRole: stringValue(record.role) ?? stringValue(record.type),
    content: content || summarizeToolCalls(toolCalls),
    rawContent: row,
    createdAt,
    model,
    tokenUsage,
    toolCalls,
    metadata: { parserIndex: index }
  };
}

function extractRawMessages(record: Record<string, unknown>): unknown[] {
  if (Array.isArray(record.messages)) return record.messages;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.events)) return record.events;
  if (Array.isArray(record.data)) return record.data;
  const choices = record.choices;
  if (Array.isArray(choices)) {
    return choices.map((choice) => asRecord(choice).message ?? asRecord(choice).delta ?? choice);
  }
  const mapping = record.mapping;
  if (mapping && typeof mapping === "object") {
    return Object.values(mapping as Record<string, unknown>)
      .map((item) => asRecord(item).message ?? item)
      .filter(Boolean);
  }
  return [record];
}

function splitTextMessages(content: string, conversationId: string, filePath: string): AILogMessage[] {
  const lines = content.split(/\r?\n/);
  const messages: AILogMessage[] = [];
  let currentRole: AILogMessage["role"] = "user";
  let buffer: string[] = [];

  function flush(index: number): void {
    const text = buffer.join("\n").trim();
    if (!text) return;
    messages.push({
      id: stableId([filePath, conversationId, index, currentRole, text.slice(0, 80)]),
      conversationId,
      role: currentRole,
      content: text,
      rawContent: text,
      createdAt: undefined,
      toolCalls: extractToolCalls(text)
    });
    buffer = [];
  }

  for (const line of lines) {
    const marker = line.match(/^\s{0,3}(?:#{1,4}\s*)?(user|human|assistant|ai|system|tool|error|codex|claude)\s*[:：-]?\s*$/i);
    const inline = line.match(/^\s{0,3}(user|human|assistant|ai|system|tool|error)\s*[:：]\s*(.+)$/i);
    if (marker) {
      flush(messages.length);
      currentRole = normalizeRole(marker[1]);
      continue;
    }
    if (inline) {
      flush(messages.length);
      currentRole = normalizeRole(inline[1]);
      buffer.push(inline[2] ?? "");
      continue;
    }
    buffer.push(line);
  }
  flush(messages.length);

  if (!messages.length && content.trim()) {
    messages.push({
      id: stableId([filePath, conversationId, "text"]),
      conversationId,
      role: "user",
      content: content.trim(),
      rawContent: content,
      createdAt: undefined
    });
  }
  return messages;
}

function extractContent(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const record = asRecord(item);
        const type = stringValue(record.type);
        if (type === "text" || type === "input_text" || type === "output_text") return stringValue(record.text) ?? "";
        if (type === "tool_use") return `Tool use: ${stringValue(record.name) ?? "unknown"}\n${safeJson(record.input)}`;
        if (type === "tool_result") return `Tool result:\n${extractContent(record.content) || safeJson(record)}`;
        if (record.text !== undefined || record.content !== undefined) return extractContent(record.text ?? record.content);
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }
  const record = asRecord(value);
  if (record.text !== undefined || record.content !== undefined) return extractContent(record.text ?? record.content);
  return safeJson(value);
}

function extractToolCalls(contentValue: unknown, explicitToolCalls?: unknown): AILogToolCall[] {
  const toolCalls: AILogToolCall[] = [];
  const explicit = Array.isArray(explicitToolCalls) ? explicitToolCalls : [];
  for (const item of explicit) {
    const record = asRecord(item);
    const functionRecord = asRecord(record.function);
    const name = stringValue(record.name) ?? stringValue(functionRecord.name) ?? "tool";
    const input = record.input ?? record.arguments ?? functionRecord.arguments;
    toolCalls.push({
      id: stringValue(record.id) ?? stableId([name, safeJson(item)]),
      name,
      type: toolTypeFromName(name),
      input,
      output: record.output,
      status: stringValue(record.status) === "error" ? "error" : "unknown",
      relatedFiles: extractRelatedFiles(input ?? record.output)
    });
  }
  if (Array.isArray(contentValue)) {
    for (const item of contentValue) {
      const record = asRecord(item);
      const type = stringValue(record.type);
      if (type !== "tool_use" && type !== "tool_result") continue;
      const name = stringValue(record.name) ?? (type === "tool_result" ? "tool_result" : "tool");
      toolCalls.push({
        id: stringValue(record.id) ?? stringValue(record.tool_use_id) ?? stableId([name, safeJson(item)]),
        name,
        type: toolTypeFromName(name),
        input: record.input,
        output: record.content ?? record.output,
        status: stringValue(record.is_error) === "true" || record.is_error === true ? "error" : type === "tool_result" ? "success" : "unknown",
        relatedFiles: extractRelatedFiles(record.input ?? record.content ?? record.output)
      });
    }
  }
  if (typeof contentValue === "string") {
    const shellMatches = contentValue.match(/^(?:\$|PS>|[A-Za-z]:\\[^>\n]+>)\s+([^\n]+)/gm) ?? [];
    for (const match of shellMatches.slice(0, 20)) {
      const command = match.replace(/^(?:\$|PS>|[A-Za-z]:\\[^>\n]+>)\s+/, "");
      toolCalls.push({
        id: stableId(["shell", command]),
        name: "shell",
        type: "shell",
        input: command,
        status: ERROR_RE.test(contentValue) ? "error" : "unknown",
        relatedFiles: extractRelatedFiles(command)
      });
    }
  }
  return dedupeToolCalls(toolCalls);
}

const ERROR_RE = /(error|exception|failed|报错|异常|失败)/i;

function extractRelatedFiles(value: unknown): string[] {
  const text = typeof value === "string" ? value : safeJson(value);
  const matches = text.match(/(?:[A-Za-z]:\\|\.{0,2}\/)?[\w.@-]+(?:[\\/][\w.@-]+)+\.[A-Za-z0-9]+/g) ?? [];
  return Array.from(new Set(matches)).slice(0, 30);
}

function extractTokenUsage(value: unknown): TokenUsage | undefined {
  const record = asRecord(value);
  const inputTokens = numberValue(record.inputTokens) ?? numberValue(record.input_tokens) ?? numberValue(record.prompt_tokens);
  const outputTokens = numberValue(record.outputTokens) ?? numberValue(record.output_tokens) ?? numberValue(record.completion_tokens);
  const cacheCreationTokens = numberValue(record.cacheCreationTokens) ?? numberValue(record.cache_creation_input_tokens);
  const cacheReadTokens = numberValue(record.cacheReadTokens) ?? numberValue(record.cache_read_input_tokens);
  const totalTokens = numberValue(record.totalTokens) ?? numberValue(record.total_tokens);
  const usage: TokenUsage = { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, totalTokens };
  const computed = (inputTokens ?? 0) + (outputTokens ?? 0) + (cacheCreationTokens ?? 0) + (cacheReadTokens ?? 0);
  if (!usage.totalTokens && computed > 0) usage.totalTokens = computed;
  return Object.values(usage).some((item) => typeof item === "number" && item > 0) ? usage : undefined;
}

function parseJsonLines(content: string): unknown[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as unknown];
      } catch {
        return [];
      }
    });
}

function inferProviderFromPath(filePath: string): Provider {
  const lower = filePath.toLowerCase();
  if (lower.includes(".claude") || lower.includes("claude")) return "claude-code";
  if (lower.includes(".codex") || lower.includes("codex")) return "codex-cli";
  if (lower.includes("openai") || lower.includes("chatgpt")) return "openai";
  if (lower.includes("anthropic")) return "anthropic";
  if (lower.includes("gemini")) return "gemini";
  return "unknown";
}

function inferProviderFromContent(content: string): Provider {
  const lower = content.slice(0, 20000).toLowerCase();
  if (lower.includes("claude") || lower.includes("anthropic")) return lower.includes("claude code") ? "claude-code" : "anthropic";
  if (lower.includes("codex")) return "codex-cli";
  if (lower.includes("openai") || lower.includes("chatgpt") || lower.includes("gpt-")) return "openai";
  if (lower.includes("gemini")) return "gemini";
  return "unknown";
}

function normalizeRole(value: unknown): AILogMessage["role"] {
  const role = String(value ?? "").toLowerCase();
  if (role.includes("assistant") || role === "ai" || role === "claude" || role === "codex") return "assistant";
  if (role.includes("system")) return "system";
  if (role.includes("tool") || role.includes("function")) return "tool";
  if (role.includes("error")) return "error";
  if (role.includes("event")) return "event";
  return "user";
}

function deriveConversationTitle(messages: AILogMessage[], fallback: string): string {
  const firstUser = messages.find((message) => message.role === "user" && message.content.trim())?.content;
  return firstUser ? truncate(firstUser, 88) : fallback;
}

function deriveProjectName(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.includes("projects")) {
    const index = parts.indexOf("projects");
    const project = parts[index + 1];
    if (project) return project.replace(/%2F/gi, "/");
  }
  return parts.at(-2) ?? parts.at(-1) ?? "Unknown Project";
}

function dedupeConversations(conversations: AILogConversation[]): AILogConversation[] {
  const seen = new Map<string, AILogConversation>();
  for (const conversation of conversations) {
    const previous = seen.get(conversation.id);
    if (!previous || conversation.messageCount > previous.messageCount) {
      seen.set(conversation.id, conversation);
    }
  }
  return Array.from(seen.values()).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function dedupeToolCalls(toolCalls: AILogToolCall[]): AILogToolCall[] {
  const seen = new Map<string, AILogToolCall>();
  for (const toolCall of toolCalls) {
    seen.set(toolCall.id, toolCall);
  }
  return Array.from(seen.values());
}

function summarizeToolCalls(toolCalls: AILogToolCall[]): string {
  return toolCalls.map((tool) => `${tool.name}: ${safeJson(tool.input ?? tool.output)}`).join("\n");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

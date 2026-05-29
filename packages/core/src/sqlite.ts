import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { AILogConversation } from "@ailog/shared";

export interface SqliteIndexStatus {
  available: boolean;
  path: string;
  conversations: number;
  messages: number;
  toolCalls: number;
  error?: string;
}

export async function rebuildSqliteIndex(dbPath: string, conversations: AILogConversation[]): Promise<SqliteIndexStatus> {
  try {
    const sqlite = (await import("node:sqlite")) as unknown as {
      DatabaseSync: new (filename: string) => {
        exec(sql: string): void;
        prepare(sql: string): {
          run(...args: unknown[]): void;
          get(...args: unknown[]): unknown;
        };
        close(): void;
      };
    };
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = new sqlite.DatabaseSync(dbPath);
    db.exec(SQLITE_SCHEMA);
    db.exec("delete from tool_calls; delete from messages; delete from conversations;");

    const insertConversation = db.prepare(
      "insert into conversations (id, provider, project_name, title, created_at, updated_at, tokens, message_count, tool_call_count, tags, json) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const insertMessage = db.prepare(
      "insert into messages (id, conversation_id, role, created_at, model, content, intent, quality_total, json) values (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const insertTool = db.prepare(
      "insert into tool_calls (id, conversation_id, message_id, name, type, status, related_files, json) values (?, ?, ?, ?, ?, ?, ?, ?)"
    );

    let messages = 0;
    let toolCalls = 0;
    for (const conversation of conversations) {
      insertConversation.run(
        conversation.id,
        conversation.provider,
        conversation.projectName ?? null,
        conversation.title ?? null,
        conversation.createdAt,
        conversation.updatedAt,
        conversation.tokenUsage?.totalTokens ?? 0,
        conversation.messageCount,
        conversation.toolCallCount,
        JSON.stringify(conversation.tags),
        JSON.stringify({ ...conversation, messages: [] })
      );
      for (const message of conversation.messages) {
        messages += 1;
        insertMessage.run(
          message.id,
          conversation.id,
          message.role,
          message.createdAt ?? null,
          message.model ?? null,
          message.content,
          message.promptIntent ?? null,
          message.promptQuality?.total ?? null,
          JSON.stringify(message)
        );
        for (const tool of message.toolCalls ?? []) {
          toolCalls += 1;
          const toolRowId = `${conversation.id}:${message.id}:${tool.id}:${toolCalls}`;
          insertTool.run(
            toolRowId,
            conversation.id,
            message.id,
            tool.name,
            tool.type,
            tool.status,
            JSON.stringify(tool.relatedFiles ?? []),
            JSON.stringify(tool)
          );
        }
      }
    }
    db.close();
    return { available: true, path: dbPath, conversations: conversations.length, messages, toolCalls };
  } catch (error) {
    return {
      available: false,
      path: dbPath,
      conversations: 0,
      messages: 0,
      toolCalls: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export const SQLITE_SCHEMA = `
create table if not exists conversations (
  id text primary key,
  provider text not null,
  project_name text,
  title text,
  created_at text not null,
  updated_at text not null,
  tokens integer not null default 0,
  message_count integer not null default 0,
  tool_call_count integer not null default 0,
  tags text not null,
  json text not null
);

create table if not exists messages (
  id text primary key,
  conversation_id text not null,
  role text not null,
  created_at text,
  model text,
  content text not null,
  intent text,
  quality_total integer,
  json text not null
);

create table if not exists tool_calls (
  id text primary key,
  conversation_id text not null,
  message_id text not null,
  name text not null,
  type text not null,
  status text not null,
  related_files text not null,
  json text not null
);

create index if not exists idx_conversations_updated_at on conversations(updated_at);
create index if not exists idx_conversations_provider on conversations(provider);
create index if not exists idx_messages_conversation_id on messages(conversation_id);
create index if not exists idx_messages_role on messages(role);
create index if not exists idx_tool_calls_conversation_id on tool_calls(conversation_id);
`;

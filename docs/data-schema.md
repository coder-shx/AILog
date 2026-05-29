# Data Schema

The canonical schema lives in `packages/shared/src/types.ts`.

## Conversation

```ts
interface AILogConversation {
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
}
```

## Message

Messages keep both normalized fields and the provider-native raw payload when available.

```ts
interface AILogMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool" | "error" | "event";
  providerRole?: string;
  content: string;
  rawContent?: unknown;
  createdAt?: string;
  model?: string;
  tokenUsage?: TokenUsage;
  toolCalls?: AILogToolCall[];
  promptIntent?: PromptIntent;
  promptQuality?: PromptQualityScore;
}
```

## Index

```ts
interface AILogIndex {
  version: number;
  generatedAt: string;
  conversations: AILogConversation[];
}
```

The MVP writes this structure to `.ailog/index.json`.

## SQLite Mirror

The optional SQLite mirror creates these tables:

- `conversations`
- `messages`
- `tool_calls`

The mirror is optimized for local querying and can be rebuilt from `.ailog/index.json`.

## Final Version Entities

- `PromptLibraryItem`: persisted reusable prompts.
- `SensitiveFinding`: local privacy scan results.
- `ConversationCompareResult`: structured two-session delta.
- `LiveSession`: local marker for active Claude/Codex/terminal work.
- `TeamWorkspace`: local-only team workspace metadata.
- `CapabilityStatus`: extension/desktop/MCP/local LLM capability inventory.

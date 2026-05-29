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

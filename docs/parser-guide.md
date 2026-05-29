# Parser Guide

AILog parser adapters convert provider-native records into the unified schema.

## Built-in Adapters

- `ClaudeJsonlAdapter`: Claude Code JSONL sessions with `sessionId`, `cwd`, `message`, `tool_use` and `tool_result` fields.
- `GenericJsonlAdapter`: JSONL files grouped by common session identifiers.
- `GenericJsonAdapter`: JSON exports with `messages`, `items`, `events`, OpenAI `choices`, or ChatGPT-style `mapping`.
- `MarkdownTextAdapter`: Markdown and text transcripts with role headings or inline role markers.

## Adding an Adapter

1. Implement `ParserAdapter`.
2. Keep provider-specific assumptions inside the adapter.
3. Preserve `rawContent` for auditability.
4. Return `AILogConversation[]`; `core` will recompute counts and analyzer fields.

## Provider Detection

Provider detection uses directory hints first, then file content hints. Unknown sources are allowed and still indexed.

## Read-only Principle

Parser code must never mutate source history files. Generated state belongs under `.ailog/`.

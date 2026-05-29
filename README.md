# AILog

Your local AI collaboration logbook.

Browse your Claude Code and Codex history like Git commits.  
Analyze your prompts like product analytics.  
Keep everything local and private.

AILog is local-first observability for your AI coding workflow.

AILog 是一个本地优先的 AI 协作历史管理与分析工具。它可以帮助你浏览、搜索、分析 Claude Code 和 Codex 的历史对话，像看 Git 日志一样回顾 AI 协作过程，像看数据仪表盘一样理解自己的 Prompt 习惯和 AI 行为模式。

![AILog screenshot placeholder](docs/screenshot-placeholder.svg)

## Features

- Git-log style Timeline for Claude Code, Codex CLI and imported AI conversations.
- Local Fastify API server with filesystem scanning and JSON index storage.
- Unified conversation schema across Claude JSONL, Codex/JSON/JSONL, Markdown and text exports.
- Dashboard metrics for sessions, messages, prompts, replies, tokens, tools, models, projects and activity.
- Prompt Intelligence: word frequency, language ratio, intent classification and heuristic quality scoring.
- Conversation detail view with Markdown rendering, tool call panels, tags, favorites and export.
- Global search across titles, prompts, replies, tool input/output, files, tags, models and projects.
- Markdown / JSON / HTML exports with sensitive data redaction enabled by default.
- Local-first settings for Claude directories, Codex directories, import directories and privacy controls.
- CLI commands for scan, stats, search, export, report and doctor.
- SQLite mirror index using Node's local `node:sqlite` runtime when enabled.
- Conversation Compare API with token, tool, file, model, tag and prompt keyword deltas.
- Sensitive information center for keys, tokens, emails, phone numbers, private keys and path leaks.
- Prompt Library persistence for reusable prompts and template curation.
- Live Session tracker for Claude, Codex and terminal workflows.
- Local team workspace metadata for local-first collaboration.
- MCP server, Tauri desktop, VS Code extension and browser extension scaffolds.

## Quick Start

```bash
pnpm install
pnpm dev
```

The web console runs at `http://127.0.0.1:1420`.  
The API server runs at `http://127.0.0.1:1421`.

If `pnpm` is not installed:

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

## CLI

```bash
pnpm --filter @ailog/cli ailog scan
pnpm --filter @ailog/cli ailog stats
pnpm --filter @ailog/cli ailog search "修复 bug"
pnpm --filter @ailog/cli ailog export --id <conversation-id> --format markdown
pnpm --filter @ailog/cli ailog report weekly
pnpm --filter @ailog/cli ailog privacy
pnpm --filter @ailog/cli ailog sqlite
pnpm --filter @ailog/cli ailog backup
pnpm --filter @ailog/cli ailog capabilities
pnpm --filter @ailog/cli ailog doctor
```

## Supported Sources

- Claude Code JSONL history under `~/.claude/`
- Codex CLI history directories configured by the user
- Generic `.json`, `.jsonl`, `.md`, `.markdown`, `.txt`, `.log`
- OpenAI / Anthropic / Gemini shaped API exports through generic adapters

Unknown formats are intentionally routed through adapter interfaces so new parsers can be added without changing the UI or data model.

## Architecture

```txt
apps/web       Vue 3 + Vite local console
apps/server    Fastify REST API
packages/core  local settings, index, scan orchestration and exports
packages/parser filesystem discovery and provider adapters
packages/analyzer prompt intelligence, stats, search and redaction
packages/shared shared TypeScript schema and utilities
packages/cli   command line interface
packages/mcp   local stdio MCP server scaffold
apps/desktop   Tauri shell scaffold
extensions/*   VS Code and browser extension scaffolds
```

AILog stores its generated local index in `.ailog/index.json` and settings in `.ailog/settings.json`. Source history files are scanned read-only.

## API

The API follows the MVP contract from the product prompt:

- `GET /api/health`
- `GET /api/settings`
- `POST /api/settings`
- `POST /api/scan`
- `GET /api/projects`
- `GET /api/conversations`
- `GET /api/conversations/:id`
- `GET /api/conversations/:id/messages`
- `POST /api/conversations/:id/tags`
- `POST /api/conversations/:id/favorite`
- `GET /api/search`
- `GET /api/stats/overview`
- `GET /api/stats/prompts`
- `GET /api/stats/tools`
- `GET /api/stats/models`
- `GET /api/stats/projects`
- `GET /api/stats/timeline`
- `GET /api/stats/ai-behavior`
- `GET /api/stats/collaboration`
- `GET /api/compare`
- `GET /api/privacy/sensitive`
- `GET /api/sqlite/status`
- `POST /api/sqlite/rebuild`
- `GET /api/prompts`
- `GET /api/prompts/:id`
- `POST /api/prompts/:id/favorite`
- `GET /api/prompt-library`
- `POST /api/prompt-library`
- `POST /api/export/conversation/:id`
- `POST /api/export/report`
- `POST /api/export/backup`
- `GET /api/live-sessions`
- `POST /api/live-sessions`
- `GET /api/team/workspaces`
- `POST /api/team/workspaces`
- `GET /api/capabilities`
- `POST /api/conversations/:id/summary`

## Privacy

- AILog runs locally by default.
- It does not upload conversation data.
- It does not call remote LLMs for analysis.
- Exports redact API keys, GitHub tokens, JWTs, SSH private keys, emails, phone numbers and common path secrets by default.
- Source files are scanned in read-only mode.

## Branch Strategy

- `v1`: verified MVP rollback branch.
- `v2-final`: final-version development branch with stage-two and stage-three capabilities.

## Final-Version Scope

The final branch includes all staged surfaces from the prompt in a local-first form. Capabilities that require external tools, browser packaging, VS Code packaging, Tauri build chains, or an actual local LLM runtime are provided as runnable scaffolds and opt-in API surfaces rather than hidden remote integrations.

## Remaining Packaging Work

- Build native Tauri installers after installing the Rust/Tauri toolchain.
- Package the VS Code extension with `vsce`.
- Load `extensions/browser` as an unpacked Manifest V3 extension.
- Wire a chosen local LLM endpoint in Settings if automatic semantic summaries are desired.

## Contributing

1. Keep features local-first by default.
2. Add parser adapters instead of coupling UI code to provider-specific history formats.
3. Keep sensitive data redaction on for new export paths.
4. Run `pnpm typecheck` before submitting changes.

## License

MIT

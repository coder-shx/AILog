# Privacy

AILog is local-first by design.

## Defaults

- Conversation data is not uploaded.
- Remote LLM analysis is off.
- Source history files are scanned read-only.
- Export redaction is enabled.

## Redaction Rules

The analyzer redacts:

- OpenAI API keys
- Anthropic API keys
- GitHub tokens
- JWT-like tokens
- SSH private keys
- email addresses
- China mainland mobile numbers
- URL query tokens
- common user path segments

## Data Locations

- Settings: `.ailog/settings.json`
- Index: `.ailog/index.json`

Delete `.ailog/` to clear generated local state. This does not touch Claude Code or Codex source history.

## Final Version Privacy Surfaces

- `GET /api/privacy/sensitive` returns local sensitive finding records.
- `POST /api/export/backup` exports local generated state as JSON.
- `GET /api/capabilities` shows which integrations are ready, scaffolded or disabled.
- Local LLM analysis is represented as an opt-in capability. The current summary endpoint uses heuristic extraction and does not call any remote model.

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AILogRepository } from "@ailog/core";

const repository = new AILogRepository();
const rl = createInterface({ input, output });

output.write(JSON.stringify({ type: "ready", name: "ailog-mcp", tools: ["ailog_stats", "ailog_search", "ailog_recent"] }) + "\n");

for await (const line of rl) {
  try {
    const request = JSON.parse(line) as { id?: string; tool?: string; arguments?: Record<string, unknown> };
    const result = await handle(request.tool ?? "", request.arguments ?? {});
    output.write(JSON.stringify({ id: request.id, result }) + "\n");
  } catch (error) {
    output.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }) + "\n");
  }
}

async function handle(tool: string, args: Record<string, unknown>): Promise<unknown> {
  if (tool === "ailog_stats") return repository.overview();
  if (tool === "ailog_recent") return repository.listConversations({ sort: "newest" }, false);
  if (tool === "ailog_search") return repository.search({ q: String(args.q ?? ""), limit: Number(args.limit ?? 20) });
  return {
    error: "Unknown tool",
    tools: {
      ailog_stats: "Return local AILog overview stats.",
      ailog_recent: "Return recent local AI collaboration sessions.",
      ailog_search: "Search local AI collaboration history with { q, limit }."
    }
  };
}

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AILogRepository } from "@ailog/core";

type JsonRpcRequest = {
  jsonrpc?: "2.0";
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
  tool?: string;
  arguments?: Record<string, unknown>;
};

const repository = new AILogRepository();
const rl = createInterface({ input, output });

for await (const line of rl) {
  if (!line.trim()) continue;
  try {
    const request = JSON.parse(line) as JsonRpcRequest;
    const response = await handleRequest(request);
    if (response) output.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    output.write(`${JSON.stringify(errorResponse(null, error instanceof Error ? error.message : String(error)))}\n`);
  }
}

async function handleRequest(request: JsonRpcRequest): Promise<unknown> {
  if (request.method === "notifications/initialized") return undefined;
  if (request.method === "initialize") {
    return resultResponse(request.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "ailog-mcp", version: "0.1.0" }
    });
  }
  if (request.method === "tools/list") {
    return resultResponse(request.id, {
      tools: [
        {
          name: "ailog_stats",
          description: "Return local AILog overview statistics.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "ailog_recent",
          description: "Return recent local AI collaboration sessions.",
          inputSchema: { type: "object", properties: { limit: { type: "number", default: 12 } } }
        },
        {
          name: "ailog_search",
          description: "Search local AI collaboration history.",
          inputSchema: {
            type: "object",
            required: ["q"],
            properties: {
              q: { type: "string" },
              limit: { type: "number", default: 20 }
            }
          }
        }
      ]
    });
  }
  if (request.method === "tools/call") {
    const params = request.params ?? {};
    const name = String(params.name ?? "");
    const args = (params.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Record<string, unknown>;
    const data = await handleTool(name, args);
    return resultResponse(request.id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
  }

  if (request.tool) {
    return { id: request.id, result: await handleTool(request.tool, request.arguments ?? {}) };
  }
  return errorResponse(request.id, `Unsupported MCP method: ${request.method ?? "unknown"}`);
}

async function handleTool(tool: string, args: Record<string, unknown>): Promise<unknown> {
  if (tool === "ailog_stats") return repository.overview();
  if (tool === "ailog_recent") {
    const limit = Number(args.limit ?? 12);
    return (await repository.listConversations({ sort: "newest" }, false)).slice(0, Number.isFinite(limit) ? limit : 12);
  }
  if (tool === "ailog_search") return repository.search({ q: String(args.q ?? ""), limit: Number(args.limit ?? 20) });
  return {
    error: "Unknown tool",
    tools: ["ailog_stats", "ailog_recent", "ailog_search"]
  };
}

function resultResponse(id: JsonRpcRequest["id"], result: unknown): unknown {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(id: JsonRpcRequest["id"], message: string): unknown {
  return { jsonrpc: "2.0", id, error: { code: -32603, message } };
}

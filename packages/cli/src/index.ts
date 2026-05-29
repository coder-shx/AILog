#!/usr/bin/env node
import { AILogRepository } from "@ailog/core";
import type { ExportRequest } from "@ailog/shared";

const repository = new AILogRepository();

async function main(): Promise<void> {
  const [command = "help", ...args] = process.argv.slice(2);

  switch (command) {
    case "scan": {
      const roots = parseRoots(args);
      const { result } = await repository.scan(roots.length ? { roots } : {});
      writeJson(result);
      break;
    }
    case "stats": {
      writeJson(await repository.overview());
      break;
    }
    case "search": {
      const q = args.filter((arg) => !arg.startsWith("--")).join(" ").trim();
      if (!q) throw new Error("Usage: ailog search <query>");
      writeJson(await repository.search({ q, limit: numberFlag(args, "--limit") ?? 20, regex: args.includes("--regex") }));
      break;
    }
    case "export": {
      const id = stringFlag(args, "--id");
      if (!id) throw new Error("Usage: ailog export --id <conversation-id> --format markdown|json|html");
      const format = (stringFlag(args, "--format") ?? "markdown") as ExportRequest["format"];
      const output = await repository.exportConversation(id, { format, redact: !args.includes("--no-redact") });
      if (!output) throw new Error(`Conversation not found: ${id}`);
      process.stdout.write(output.content);
      break;
    }
    case "report": {
      const type = args[0] ?? "weekly";
      const report = await repository.exportReport(type, !args.includes("--no-redact"));
      process.stdout.write(report.content);
      break;
    }
    case "doctor": {
      writeJson(await repository.doctor());
      break;
    }
    case "serve": {
      process.stdout.write("Run `pnpm dev` to start the API server and web console.\n");
      break;
    }
    case "help":
    default:
      process.stdout.write(helpText());
  }
}

function parseRoots(args: string[]): Array<{ path: string; provider?: "claude-code" | "codex-cli" | "unknown"; projectName?: string }> {
  const roots: Array<{ path: string; provider?: "claude-code" | "codex-cli" | "unknown"; projectName?: string }> = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--dir") continue;
    const sourcePath = args[index + 1];
    if (!sourcePath) continue;
    roots.push({
      path: sourcePath,
      provider: (stringFlag(args, "--provider") as "claude-code" | "codex-cli" | "unknown" | undefined) ?? "unknown",
      projectName: stringFlag(args, "--project")
    });
  }
  return roots;
}

function stringFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function numberFlag(args: string[], flag: string): number | undefined {
  const value = stringFlag(args, flag);
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function helpText(): string {
  return `AILog CLI

Commands:
  ailog scan [--dir <path> --provider claude-code|codex-cli|unknown]
  ailog stats
  ailog search "修复 bug" [--limit 20] [--regex]
  ailog export --id <conversation-id> --format markdown|json|html
  ailog report weekly|monthly|project
  ailog doctor
  ailog serve
`;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

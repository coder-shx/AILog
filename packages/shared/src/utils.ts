import { createHash } from "node:crypto";
import type { TokenUsage } from "./types";

export function stableId(parts: Array<string | number | undefined | null>): string {
  return createHash("sha1")
    .update(parts.filter((part) => part !== undefined && part !== null).join("|"))
    .digest("hex")
    .slice(0, 16);
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function normalizeDate(value: unknown, fallback = isoNow()): string {
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return fallback;
}

export function sumTokenUsage(usages: Array<TokenUsage | undefined>): TokenUsage | undefined {
  const result: TokenUsage = {};
  for (const usage of usages) {
    if (!usage) continue;
    result.inputTokens = (result.inputTokens ?? 0) + (usage.inputTokens ?? 0);
    result.outputTokens = (result.outputTokens ?? 0) + (usage.outputTokens ?? 0);
    result.cacheCreationTokens = (result.cacheCreationTokens ?? 0) + (usage.cacheCreationTokens ?? 0);
    result.cacheReadTokens = (result.cacheReadTokens ?? 0) + (usage.cacheReadTokens ?? 0);
    result.totalTokens = (result.totalTokens ?? 0) + (usage.totalTokens ?? 0);
  }
  const total =
    (result.inputTokens ?? 0) +
    (result.outputTokens ?? 0) +
    (result.cacheCreationTokens ?? 0) +
    (result.cacheReadTokens ?? 0);
  if (!result.totalTokens && total > 0) {
    result.totalTokens = total;
  }
  return Object.values(result).some((value) => typeof value === "number" && value > 0) ? result : undefined;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function truncate(value: string, length = 140): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > length ? `${compact.slice(0, length - 1)}...` : compact;
}

export function countCodeBlocks(value: string): number {
  return (value.match(/```[\s\S]*?```/g) ?? []).length;
}


<template>
  <span class="badge" :class="tone">
    <span class="h-2 w-2 rounded-full" :style="{ background: dot }"></span>
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Provider } from "@ailog/shared";

const props = defineProps<{ provider: Provider }>();

const label = computed(() => {
  const map: Record<Provider, string> = {
    "claude-code": "Claude",
    "codex-cli": "Codex",
    openai: "OpenAI",
    anthropic: "Anthropic",
    gemini: "Gemini",
    unknown: "Unknown"
  };
  return map[props.provider];
});

const dot = computed(() => {
  const map: Record<Provider, string> = {
    "claude-code": "var(--green)",
    "codex-cli": "var(--cyan)",
    openai: "#78dcca",
    anthropic: "var(--amber)",
    gemini: "#9bbcff",
    unknown: "#8c9491"
  };
  return map[props.provider];
});

const tone = computed(() => (props.provider === "unknown" ? "opacity-80" : ""));
</script>

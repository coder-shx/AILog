<template>
  <article :id="message.id" class="panel-soft p-4">
    <header class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="badge">{{ message.role }}</span>
        <span v-if="message.model" class="label mono">{{ message.model }}</span>
        <span v-if="message.promptIntent" class="badge">{{ message.promptIntent }}</span>
        <span v-if="message.promptQuality" class="badge">Q {{ message.promptQuality.total }}</span>
      </div>
      <button class="btn h-8" @click="copy(message.content)" title="Copy">
        <Copy :size="14" />
      </button>
    </header>
    <div class="message-content" v-html="html"></div>
    <div v-if="message.toolCalls?.length" class="mt-4 grid gap-2">
      <details v-for="tool in message.toolCalls" :key="tool.id" class="rounded-lg border border-[var(--line)] bg-[#101314] p-3">
        <summary class="cursor-pointer text-sm">
          <span class="mono">{{ tool.name }}</span>
          <span class="ml-2 text-[#9da5a2]">{{ tool.type }} / {{ tool.status }}</span>
        </summary>
        <pre class="mt-3 overflow-auto text-xs text-[#cfd7d3]">{{ JSON.stringify({ input: tool.input, output: tool.output, files: tool.relatedFiles }, null, 2) }}</pre>
      </details>
    </div>
  </article>
</template>

<script setup lang="ts">
import MarkdownIt from "markdown-it";
import { Copy } from "lucide-vue-next";
import { computed } from "vue";
import type { AILogMessage } from "@ailog/shared";

const props = defineProps<{ message: AILogMessage }>();
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });
const html = computed(() => md.render(props.message.content || ""));

async function copy(value: string) {
  await navigator.clipboard?.writeText(value);
}
</script>

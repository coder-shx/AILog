<template>
  <RouterLink :to="`/conversations/${conversation.id}`" class="relative grid grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-lg px-1 py-3 hover:bg-white/[0.03]">
    <div class="relative z-10 mt-1 h-8 w-8 rounded-full border border-[var(--line)] bg-[#101314] grid place-items-center">
      <GitCommitHorizontal :size="16" class="text-[var(--green)]" />
    </div>
    <div class="panel-soft p-4">
      <div class="flex flex-wrap items-center gap-2">
        <ProviderBadge :provider="conversation.provider" />
        <span class="label mono">{{ formatDate(conversation.updatedAt) }}</span>
        <span v-if="conversation.projectName" class="badge">{{ conversation.projectName }}</span>
        <span v-for="tag in conversation.tags.slice(0, 4)" :key="tag" class="badge">{{ tag }}</span>
      </div>
      <div class="mt-3 text-[15px] font-semibold leading-6 text-white">{{ conversation.title || conversation.id }}</div>
      <div class="mt-2 line-clamp-2 text-sm leading-6 text-[#b6bfbb]">{{ conversation.summary }}</div>
      <div class="mt-3 flex flex-wrap gap-2 text-xs text-[#9da5a2]">
        <span>{{ conversation.messageCount }} messages</span>
        <span>{{ conversation.tokenUsage?.totalTokens ?? 0 }} tokens</span>
        <span>{{ conversation.toolCallCount }} tools</span>
        <span v-if="conversation.hasShell">shell</span>
        <span v-if="conversation.hasMcp">mcp</span>
        <span v-if="conversation.hasErrors" class="text-[var(--red)]">error</span>
      </div>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { GitCommitHorizontal } from "lucide-vue-next";
import type { AILogConversation } from "@ailog/shared";
import ProviderBadge from "./ProviderBadge.vue";

defineProps<{ conversation: AILogConversation }>();

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
</script>

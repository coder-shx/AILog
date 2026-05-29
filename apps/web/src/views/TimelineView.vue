<template>
  <section class="content-wrap grid gap-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Timeline</h1>
        <p class="label mt-1">Git-log style AI collaboration history</p>
      </div>
      <span class="badge mono">{{ conversations.length }} entries</span>
    </div>

    <div class="panel grid gap-3 p-4 lg:grid-cols-[1fr_180px_180px_180px]">
      <input v-model="filters.keyword" class="input" placeholder="Keyword" @keyup.enter="load" />
      <select v-model="filters.provider" class="select" @change="load">
        <option value="">All providers</option>
        <option value="claude-code">Claude</option>
        <option value="codex-cli">Codex</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="gemini">Gemini</option>
        <option value="unknown">Unknown</option>
      </select>
      <select v-model="filters.sort" class="select" @change="load">
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="token_desc">Token</option>
        <option value="tool_desc">Tools</option>
        <option value="duration_desc">Duration</option>
        <option value="user_messages_desc">User turns</option>
      </select>
      <button class="btn btn-primary" @click="load">
        <Filter :size="16" />
        Apply
      </button>
    </div>

    <div v-if="conversations.length" class="timeline-rail grid gap-1">
      <TimelineItem v-for="conversation in conversations" :key="conversation.id" :conversation="conversation" />
    </div>
    <EmptyState v-else title="No timeline entries" text="Adjust filters or scan local Claude/Codex history." :icon="GitCommitHorizontal" />
  </section>
</template>

<script setup lang="ts">
import { Filter, GitCommitHorizontal } from "lucide-vue-next";
import { onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import type { AILogConversation, ConversationFilters } from "@ailog/shared";
import EmptyState from "@/components/EmptyState.vue";
import TimelineItem from "@/components/TimelineItem.vue";
import { client } from "@/lib/api";

const route = useRoute();
const conversations = ref<AILogConversation[]>([]);
const filters = reactive<ConversationFilters>({
  keyword: "",
  provider: undefined,
  sort: "newest",
  tag: undefined
});

onMounted(loadFromRoute);
watch(() => route.query, loadFromRoute);

async function loadFromRoute() {
  filters.tag = typeof route.query.tag === "string" ? route.query.tag : undefined;
  filters.keyword = typeof route.query.keyword === "string" ? route.query.keyword : "";
  await load();
}

async function load() {
  conversations.value = await client.conversations({
    ...filters,
    provider: filters.provider || undefined,
    keyword: filters.keyword || undefined
  });
}
</script>

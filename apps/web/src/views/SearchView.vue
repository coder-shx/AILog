<template>
  <section class="content-wrap grid gap-5">
    <div>
      <h1 class="text-2xl font-semibold">Search</h1>
      <p class="label mt-1">Global search across prompts, replies, tools, files and tags</p>
    </div>

    <div class="panel grid gap-3 p-4 lg:grid-cols-[1fr_160px_140px_120px]">
      <input v-model="q" class="input" placeholder="Keyword or regex" @keyup.enter="run" />
      <select v-model="provider" class="select">
        <option value="">All providers</option>
        <option value="claude-code">Claude</option>
        <option value="codex-cli">Codex</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="gemini">Gemini</option>
      </select>
      <select v-model="role" class="select">
        <option value="">All roles</option>
        <option value="user">User</option>
        <option value="assistant">Assistant</option>
        <option value="tool">Tool</option>
        <option value="system">System</option>
      </select>
      <button class="btn btn-primary" @click="run">
        <Search :size="16" />
        Search
      </button>
      <label class="flex items-center gap-2 text-sm text-[#b6bfbb]">
        <input v-model="regex" type="checkbox" />
        Regex
      </label>
      <label class="flex items-center gap-2 text-sm text-[#b6bfbb]">
        <input v-model="caseSensitive" type="checkbox" />
        Case sensitive
      </label>
    </div>

    <div v-if="results.length" class="grid gap-3">
      <RouterLink v-for="result in results" :key="`${result.conversationId}-${result.messageId ?? 'conversation'}`" :to="linkTo(result)" class="panel-soft p-4 hover:border-[#4b5758]">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <ProviderBadge :provider="result.provider" />
          <span v-if="result.role" class="badge">{{ result.role }}</span>
          <span v-if="result.projectName" class="badge">{{ result.projectName }}</span>
          <span class="label mono">{{ result.createdAt ? new Date(result.createdAt).toLocaleString() : "" }}</span>
        </div>
        <div class="font-semibold">{{ result.title ?? result.conversationId }}</div>
        <p class="mt-2 text-sm leading-6 text-[#b6bfbb]">{{ result.snippet }}</p>
      </RouterLink>
    </div>
    <EmptyState v-else title="No search results" text="Run a query after scanning local history." :icon="Search" />
  </section>
</template>

<script setup lang="ts">
import { Search } from "lucide-vue-next";
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import type { AILogRole, Provider, SearchResult } from "@ailog/shared";
import EmptyState from "@/components/EmptyState.vue";
import ProviderBadge from "@/components/ProviderBadge.vue";
import { client } from "@/lib/api";

const route = useRoute();
const q = ref("");
const provider = ref<Provider | "">("");
const role = ref<AILogRole | "">("");
const regex = ref(false);
const caseSensitive = ref(false);
const results = ref<SearchResult[]>([]);

onMounted(() => {
  q.value = typeof route.query.q === "string" ? route.query.q : "";
  if (q.value) run();
});

async function run() {
  results.value = await client.search({
    q: q.value,
    provider: provider.value || undefined,
    role: role.value || undefined,
    regex: regex.value,
    caseSensitive: caseSensitive.value,
    limit: 100
  });
}

function linkTo(result: SearchResult) {
  return result.messageId ? `/conversations/${result.conversationId}#${result.messageId}` : `/conversations/${result.conversationId}`;
}
</script>

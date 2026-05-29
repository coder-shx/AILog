<template>
  <section class="content-wrap grid gap-5">
    <div v-if="conversation" class="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
      <aside class="panel hidden max-h-[calc(100vh-116px)] overflow-auto p-3 xl:block">
        <div class="label mb-3">Messages</div>
        <a v-for="message in conversation.messages" :key="message.id" :href="`#${message.id}`" class="mb-1 block rounded-md px-2 py-2 text-sm hover:bg-white/[0.04]">
          <span class="badge mr-2">{{ message.role }}</span>
          <span class="text-[#cfd7d3]">{{ truncate(message.content, 44) }}</span>
        </a>
      </aside>

      <main class="grid gap-4">
        <div class="panel p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <ProviderBadge :provider="conversation.provider" />
                <span class="badge">{{ conversation.projectName ?? "Unknown Project" }}</span>
                <span v-if="conversation.favorite" class="badge">favorite</span>
              </div>
              <input v-model="titleInput" class="input mt-1 max-w-3xl text-lg font-semibold" />
              <textarea v-model="summaryInput" class="textarea mt-2 max-w-3xl" rows="2" />
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="btn" @click="saveMeta">
                <Save :size="16" />
              </button>
              <button class="btn" @click="toggleFavorite">
                <Star :size="16" />
              </button>
              <button class="btn" @click="exportAs('markdown')">
                <Download :size="16" />
                MD
              </button>
              <button class="btn" @click="exportAs('json')">
                <Braces :size="16" />
                JSON
              </button>
              <button class="btn" @click="exportAs('html')">
                <FileCode2 :size="16" />
                HTML
              </button>
              <button class="btn" @click="exportAs('pdf')">
                <FileDown :size="16" />
                PDF
              </button>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <span v-for="tag in conversation.tags" :key="tag" class="badge">{{ tag }}</span>
          </div>
          <div class="mt-3 flex gap-2">
            <input v-model="tagInput" class="input max-w-lg" placeholder="tag-a, tag-b" @keyup.enter="saveTags" />
            <button class="btn" @click="saveTags">Save</button>
          </div>
        </div>

        <MessageBubble v-for="message in conversation.messages" :key="message.id" :message="message" @favorite="favoriteMessage" @tag="tagMessage" />
      </main>

      <aside class="panel h-max p-4">
        <h2 class="section-title mb-4">Insight</h2>
        <div class="grid gap-3">
          <MetricLine label="Messages" :value="conversation.messageCount" />
          <MetricLine label="User prompts" :value="conversation.userMessageCount" />
          <MetricLine label="AI replies" :value="conversation.assistantMessageCount" />
          <MetricLine label="Tokens" :value="conversation.tokenUsage?.totalTokens ?? 0" />
          <MetricLine label="Tools" :value="conversation.toolCallCount" />
          <MetricLine label="Files" :value="conversation.modifiedFileCount ?? 0" />
        </div>
        <div class="mt-5">
          <div class="label mb-2">Models</div>
          <div class="flex flex-wrap gap-2">
            <span v-for="model in conversation.modelNames" :key="model" class="badge">{{ model }}</span>
          </div>
        </div>
        <div class="mt-5">
          <div class="label mb-2">Tool calls</div>
          <div class="grid gap-2">
            <div v-for="tool in tools" :key="tool.id" class="rounded-md border border-[var(--line)] p-2 text-sm">
              <div class="mono">{{ tool.name }}</div>
              <div class="label">{{ tool.type }} · {{ tool.status }}</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
    <EmptyState v-else title="Conversation not found" :icon="MessageSquare" />
  </section>
</template>

<script setup lang="ts">
import { Braces, Download, FileCode2, FileDown, MessageSquare, Save, Star } from "lucide-vue-next";
import { computed, defineComponent, h, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import type { AILogConversation, ExportRequest } from "@ailog/shared";
import EmptyState from "@/components/EmptyState.vue";
import MessageBubble from "@/components/MessageBubble.vue";
import ProviderBadge from "@/components/ProviderBadge.vue";
import { client } from "@/lib/api";

const route = useRoute();
const conversation = ref<AILogConversation | null>(null);
const tagInput = ref("");
const titleInput = ref("");
const summaryInput = ref("");

const tools = computed(() => conversation.value?.messages.flatMap((message) => message.toolCalls ?? []) ?? []);

onMounted(load);
watch(() => route.params.id, load);

async function load() {
  const id = String(route.params.id);
  conversation.value = await client.conversation(id);
  tagInput.value = conversation.value.tags.join(", ");
  titleInput.value = conversation.value.title ?? "";
  summaryInput.value = conversation.value.summary ?? "";
}

async function saveTags() {
  if (!conversation.value) return;
  conversation.value = await client.tags(
    conversation.value.id,
    tagInput.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  );
}

async function toggleFavorite() {
  if (!conversation.value) return;
  conversation.value = await client.favorite(conversation.value.id, !conversation.value.favorite);
}

async function saveMeta() {
  if (!conversation.value) return;
  conversation.value = await client.updateConversation(conversation.value.id, { title: titleInput.value, summary: summaryInput.value });
}

async function favoriteMessage(messageId: string, favorite: boolean) {
  if (!conversation.value) return;
  conversation.value = await client.updateMessageState(conversation.value.id, messageId, { favorite });
}

async function tagMessage(messageId: string, tag: string) {
  if (!conversation.value) return;
  const message = conversation.value.messages.find((item) => item.id === messageId);
  const tags = Array.from(new Set([...(message?.tags ?? []), tag]));
  conversation.value = await client.updateMessageState(conversation.value.id, messageId, { tags });
}

async function exportAs(format: ExportRequest["format"]) {
  if (!conversation.value) return;
  const result = await client.exportConversation(conversation.value.id, { format, redact: true });
  const blob = new Blob([result.content], { type: result.contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = result.filename;
  link.click();
  URL.revokeObjectURL(url);
}

function truncate(value: string, length: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > length ? `${compact.slice(0, length - 1)}...` : compact;
}

const MetricLine = defineComponent({
  props: { label: { type: String, required: true }, value: { type: [String, Number], required: true } },
  setup(props) {
    return () =>
      h("div", { class: "flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2" }, [
        h("span", { class: "label" }, props.label),
        h("span", { class: "mono text-sm" }, String(props.value))
      ]);
  }
});
</script>

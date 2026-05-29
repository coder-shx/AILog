<template>
  <section class="content-wrap grid gap-5">
    <div>
      <h1 class="text-2xl font-semibold">Compare</h1>
      <p class="label mt-1">Conversation-level delta view</p>
    </div>

    <div class="panel grid gap-3 p-4 md:grid-cols-2">
      <select v-model="leftId" class="select">
        <option value="">Left conversation</option>
        <option v-for="conversation in conversations" :key="conversation.id" :value="conversation.id">{{ conversation.title }}</option>
      </select>
      <select v-model="rightId" class="select">
        <option value="">Right conversation</option>
        <option v-for="conversation in conversations" :key="conversation.id" :value="conversation.id">{{ conversation.title }}</option>
      </select>
    </div>

    <div v-if="left && right" class="grid gap-5 md:grid-cols-2">
      <CompareCard label="Left" :conversation="left" />
      <CompareCard label="Right" :conversation="right" />
    </div>
    <EmptyState v-else title="Select two conversations" text="Use the selectors above to compare message count, tokens, tools, models and tags." :icon="GitCompareArrows" />
  </section>
</template>

<script setup lang="ts">
import { GitCompareArrows } from "lucide-vue-next";
import { computed, defineComponent, h, ref } from "vue";
import type { AILogConversation } from "@ailog/shared";
import EmptyState from "@/components/EmptyState.vue";
import ProviderBadge from "@/components/ProviderBadge.vue";
import { useAILogStore } from "@/stores/ailog";

const store = useAILogStore();
const conversations = computed(() => store.conversations);
const leftId = ref("");
const rightId = ref("");
const left = computed(() => conversations.value.find((conversation) => conversation.id === leftId.value));
const right = computed(() => conversations.value.find((conversation) => conversation.id === rightId.value));

const CompareCard = defineComponent({
  props: { label: { type: String, required: true }, conversation: { type: Object as () => AILogConversation, required: true } },
  setup(props) {
    return () =>
      h("div", { class: "panel p-4" }, [
        h("div", { class: "mb-3 flex items-center justify-between gap-3" }, [
          h("div", [h("div", { class: "label" }, props.label), h("h2", { class: "section-title mt-1" }, props.conversation.title)]),
          h(ProviderBadge, { provider: props.conversation.provider })
        ]),
        h("div", { class: "grid gap-2" }, [
          row("Project", props.conversation.projectName ?? "Unknown"),
          row("Messages", props.conversation.messageCount),
          row("User prompts", props.conversation.userMessageCount),
          row("AI replies", props.conversation.assistantMessageCount),
          row("Tokens", props.conversation.tokenUsage?.totalTokens ?? 0),
          row("Tools", props.conversation.toolCallCount),
          row("Models", props.conversation.modelNames.join(", ") || "N/A"),
          row("Tags", props.conversation.tags.join(", ") || "none")
        ])
      ]);
  }
});

function row(label: string, value: string | number) {
  return h("div", { class: "flex items-start justify-between gap-3 border-b border-[var(--line)] py-2 text-sm" }, [
    h("span", { class: "label" }, label),
    h("span", { class: "max-w-[70%] text-right text-[#e5ebe8]" }, String(value))
  ]);
}
</script>

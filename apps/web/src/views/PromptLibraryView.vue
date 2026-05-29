<template>
  <section class="content-wrap grid gap-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Prompt Library</h1>
        <p class="label mt-1">Reusable prompts distilled from high-quality history</p>
      </div>
      <button class="btn" @click="load">
        <RefreshCcw :size="16" />
        Refresh
      </button>
    </div>

    <div v-if="items.length" class="grid gap-3">
      <div v-for="item in items" :key="String(item.id)" class="panel-soft p-4">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span class="badge">{{ item.intent ?? "prompt" }}</span>
          <span class="badge mono">Q {{ item.score ?? 0 }}</span>
          <span v-if="item.projectName" class="badge">{{ item.projectName }}</span>
        </div>
        <p class="whitespace-pre-wrap text-sm leading-6 text-[#d9dfdc]">{{ item.content }}</p>
        <button class="btn mt-3" @click="copy(String(item.content ?? ''))">
          <Copy :size="16" />
          Copy
        </button>
      </div>
    </div>
    <EmptyState v-else title="No reusable prompts yet" text="High quality prompts and favorites will appear here." :icon="BookMarked" />
  </section>
</template>

<script setup lang="ts">
import { BookMarked, Copy, RefreshCcw } from "lucide-vue-next";
import { onMounted, ref } from "vue";
import EmptyState from "@/components/EmptyState.vue";
import { client } from "@/lib/api";

const items = ref<Array<Record<string, unknown>>>([]);
onMounted(load);

async function load() {
  items.value = await client.promptLibrary();
}

async function copy(value: string) {
  await navigator.clipboard?.writeText(value);
}
</script>

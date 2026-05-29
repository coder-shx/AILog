<template>
  <div v-if="open" class="fixed inset-0 z-50 bg-black/60 p-4" @click.self="$emit('close')">
    <div class="mx-auto mt-20 w-full max-w-2xl panel p-3 shadow-2xl">
      <div class="flex items-center gap-2 border-b border-[var(--line)] pb-3">
        <Search :size="18" class="text-[var(--muted)]" />
        <input v-model="query" class="w-full bg-transparent outline-none" placeholder="Search conversations" autofocus @keydown.enter="goSearch" />
      </div>
      <div class="grid gap-1 pt-3">
        <button v-for="item in actions" :key="item.path" class="flex items-center justify-between rounded-md px-3 py-2 text-left hover:bg-white/[0.04]" @click="navigate(item.path)">
          <span>{{ item.label }}</span>
          <span class="label mono">{{ item.key }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Search } from "lucide-vue-next";
import { ref } from "vue";
import { useRouter } from "vue-router";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const router = useRouter();
const query = ref("");

const actions = [
  { label: "Dashboard", path: "/", key: "G D" },
  { label: "Timeline", path: "/timeline", key: "G T" },
  { label: "Prompt Insight", path: "/prompts", key: "G P" },
  { label: "Search", path: "/search", key: "G /" },
  { label: "Settings", path: "/settings", key: "G S" }
];

function navigate(path: string) {
  router.push(path);
  emit("close");
}

function goSearch() {
  router.push({ path: "/search", query: { q: query.value } });
  emit("close");
}
</script>

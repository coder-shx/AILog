<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="mb-7 flex items-center gap-3 px-2">
        <div class="grid h-9 w-9 place-items-center rounded-lg border border-[var(--line)] bg-[#1a1e1f]">
          <Activity :size="20" class="text-[var(--green)]" />
        </div>
        <div>
          <div class="text-base font-semibold">AILog</div>
          <div class="label">Local AI observability</div>
        </div>
      </div>

      <nav class="grid gap-1">
        <RouterLink v-for="item in nav" :key="item.path" :to="item.path" class="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-[#c7cfcb] hover:bg-white/[0.04]" active-class="bg-white/[0.07] text-white">
          <component :is="item.icon" :size="17" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="mt-6 border-t border-[var(--line)] pt-4">
        <button class="btn btn-primary w-full" :disabled="store.loading" @click="store.scan()">
          <RefreshCcw :size="16" :class="{ 'animate-spin': store.loading }" />
          Scan
        </button>
        <div v-if="store.error" class="mt-3 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-xs leading-5 text-red-200">
          {{ store.error }}
        </div>
      </div>
    </aside>

    <main class="main-shell">
      <header class="command-bar flex items-center justify-between gap-4 px-5">
        <button class="flex h-9 w-full max-w-xl items-center gap-3 rounded-md border border-[var(--line)] bg-[#101314] px-3 text-left text-sm text-[#9da5a2]" @click="paletteOpen = true">
          <Search :size="16" />
          <span>Search, jump, filter</span>
          <span class="ml-auto badge mono">Ctrl K</span>
        </button>
        <div class="hidden items-center gap-2 md:flex">
          <span class="badge">{{ store.overview?.totalConversations ?? 0 }} sessions</span>
          <span class="badge">{{ store.overview?.totalTokens ?? 0 }} tokens</span>
        </div>
      </header>
      <RouterView />
    </main>

    <CommandPalette :open="paletteOpen" @close="paletteOpen = false" />
  </div>
</template>

<script setup lang="ts">
import {
  Activity,
  BarChart3,
  BookMarked,
  FileText,
  GaugeCircle,
  GitCompareArrows,
  GitCommitHorizontal,
  LayoutDashboard,
  Radio,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  Workflow
} from "lucide-vue-next";
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import CommandPalette from "@/components/CommandPalette.vue";
import { useAILogStore } from "@/stores/ailog";

const store = useAILogStore();
const router = useRouter();
const paletteOpen = ref(false);
let pendingG = false;

const nav = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Timeline", path: "/timeline", icon: GitCommitHorizontal },
  { label: "Search", path: "/search", icon: Search },
  { label: "Prompts", path: "/prompts", icon: BarChart3 },
  { label: "Projects", path: "/projects", icon: Workflow },
  { label: "Compare", path: "/compare", icon: GitCompareArrows },
  { label: "Library", path: "/library", icon: BookMarked },
  { label: "Reports", path: "/reports", icon: FileText },
  { label: "Privacy", path: "/privacy", icon: ShieldCheck },
  { label: "Live", path: "/live", icon: Radio },
  { label: "Capabilities", path: "/capabilities", icon: GaugeCircle },
  { label: "Settings", path: "/settings", icon: Settings },
  { label: "Tags", path: "/timeline?tag=high-quality-prompt", icon: Tags }
];

onMounted(() => {
  store.bootstrap();
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => window.removeEventListener("keydown", onKeydown));

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    paletteOpen.value = true;
    return;
  }
  if (event.key.toLowerCase() === "g") {
    pendingG = true;
    window.setTimeout(() => {
      pendingG = false;
    }, 900);
    return;
  }
  if (!pendingG) return;
  const key = event.key.toLowerCase();
  pendingG = false;
  if (key === "d") router.push("/");
  if (key === "t") router.push("/timeline");
  if (key === "p") router.push("/prompts");
  if (key === "s") router.push("/settings");
}
</script>

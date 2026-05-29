<template>
  <section class="content-wrap grid gap-5">
    <div>
      <h1 class="text-2xl font-semibold">Live Sessions</h1>
      <p class="label mt-1">Local-first session tracker for Claude, Codex or terminal workflows</p>
    </div>

    <div class="panel grid gap-3 p-4 md:grid-cols-[160px_1fr_1fr_120px]">
      <select v-model="provider" class="select">
        <option value="terminal">Terminal</option>
        <option value="claude-code">Claude Code</option>
        <option value="codex-cli">Codex CLI</option>
      </select>
      <input v-model="cwd" class="input" placeholder="Working directory" />
      <input v-model="command" class="input" placeholder="Command, optional" />
      <button class="btn btn-primary" @click="create">
        <Plus :size="16" />
        Create
      </button>
    </div>

    <div v-if="sessions.length" class="grid gap-3">
      <div v-for="session in sessions" :key="session.id" class="panel-soft p-4">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span class="badge">{{ session.provider }}</span>
          <span class="badge">{{ session.status }}</span>
          <span class="label mono">{{ new Date(session.createdAt).toLocaleString() }}</span>
        </div>
        <div class="font-semibold">{{ session.command || "Manual live session" }}</div>
        <div class="label mt-1 mono">{{ session.cwd }}</div>
      </div>
    </div>
    <EmptyState v-else title="No live sessions" text="Create a local session marker before starting Claude, Codex or a terminal workflow." :icon="TerminalSquare" />
  </section>
</template>

<script setup lang="ts">
import { Plus, TerminalSquare } from "lucide-vue-next";
import { onMounted, ref } from "vue";
import type { LiveSession } from "@ailog/shared";
import EmptyState from "@/components/EmptyState.vue";
import { client } from "@/lib/api";

const sessions = ref<LiveSession[]>([]);
const provider = ref<LiveSession["provider"]>("terminal");
const cwd = ref("");
const command = ref("");

onMounted(load);

async function load() {
  sessions.value = await client.liveSessions();
}

async function create() {
  await client.createLiveSession({ provider: provider.value, cwd: cwd.value || undefined, command: command.value || undefined });
  cwd.value = "";
  command.value = "";
  await load();
}
</script>

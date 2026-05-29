<template>
  <section class="content-wrap grid gap-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Settings</h1>
        <p class="label mt-1">Local sources, privacy and indexing</p>
      </div>
      <div class="flex gap-2">
        <button class="btn" @click="load">
          <RefreshCcw :size="16" />
          Reload
        </button>
        <button class="btn btn-primary" @click="save">
          <Save :size="16" />
          Save
        </button>
      </div>
    </div>

    <div v-if="settings" class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div class="grid gap-5">
        <div class="panel p-4">
          <h2 class="section-title mb-4">History Directories</h2>
          <div class="grid gap-4">
            <label class="grid gap-2">
              <span class="label">Claude directories</span>
              <textarea v-model="claudeDirs" class="textarea" />
            </label>
            <label class="grid gap-2">
              <span class="label">Codex directories</span>
              <textarea v-model="codexDirs" class="textarea" />
            </label>
            <label class="grid gap-2">
              <span class="label">Import directories</span>
              <textarea v-model="importDirs" class="textarea" />
            </label>
          </div>
        </div>

        <div class="panel p-4">
          <h2 class="section-title mb-4">Indexing</h2>
          <div class="grid gap-3 md:grid-cols-2">
            <ToggleRow v-model="settings.autoScan" label="Auto scan" />
            <ToggleRow v-model="settings.useSQLiteIndex" label="SQLite index" />
            <ToggleRow v-model="settings.fullTextSearch" label="Full text search" />
            <ToggleRow v-model="settings.autoTagging" label="Auto tagging" />
            <ToggleRow v-model="settings.promptQualityScoring" label="Prompt quality" />
            <ToggleRow v-model="settings.advancedAIAnalysis" label="Advanced AI analysis" />
          </div>
          <label class="mt-4 grid max-w-xs gap-2">
            <span class="label">Scan interval minutes</span>
            <input v-model.number="settings.scanIntervalMinutes" class="input" type="number" min="1" />
          </label>
        </div>
      </div>

      <aside class="panel h-max p-4">
        <h2 class="section-title mb-4">Privacy</h2>
        <div class="grid gap-3">
          <ToggleRow v-model="settings.sensitiveScan" label="Sensitive scan" />
          <ToggleRow v-model="settings.redactExports" label="Redact exports" />
          <ToggleRow v-model="settings.readOnlySources" label="Read-only sources" />
        </div>
        <div class="mt-5 grid gap-3">
          <label class="grid gap-2">
            <span class="label">Theme</span>
            <select v-model="settings.theme" class="select">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </label>
          <label class="grid gap-2">
            <span class="label">Language</span>
            <select v-model="settings.language" class="select">
              <option value="zh-CN">中文</option>
              <option value="en-US">English</option>
            </select>
          </label>
        </div>
        <button class="btn btn-primary mt-5 w-full" @click="scan">
          <DatabaseZap :size="16" />
          Scan Now
        </button>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { DatabaseZap, RefreshCcw, Save } from "lucide-vue-next";
import { computed, defineComponent, h, onMounted, ref } from "vue";
import type { AILogSettings } from "@ailog/shared";
import { client } from "@/lib/api";
import { useAILogStore } from "@/stores/ailog";

const store = useAILogStore();
const settings = ref<AILogSettings | null>(null);

const claudeDirs = computed({
  get: () => settings.value?.claudeDirs.join("\n") ?? "",
  set: (value: string) => {
    if (settings.value) settings.value.claudeDirs = splitLines(value);
  }
});

const codexDirs = computed({
  get: () => settings.value?.codexDirs.join("\n") ?? "",
  set: (value: string) => {
    if (settings.value) settings.value.codexDirs = splitLines(value);
  }
});

const importDirs = computed({
  get: () => settings.value?.importDirs.join("\n") ?? "",
  set: (value: string) => {
    if (settings.value) settings.value.importDirs = splitLines(value);
  }
});

onMounted(load);

async function load() {
  settings.value = await client.settings();
}

async function save() {
  if (!settings.value) return;
  settings.value = await client.saveSettings(settings.value);
  store.settings = settings.value;
}

async function scan() {
  await save();
  await store.scan();
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const ToggleRow = defineComponent({
  props: { modelValue: { type: Boolean, required: true }, label: { type: String, required: true } },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () =>
      h("label", { class: "flex items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[#101314] px-3 py-2 text-sm" }, [
        h("span", props.label),
        h("input", {
          type: "checkbox",
          checked: props.modelValue,
          onChange: (event: Event) => emit("update:modelValue", (event.target as HTMLInputElement).checked)
        })
      ]);
  }
});
</script>

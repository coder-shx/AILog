<template>
  <section class="content-wrap grid gap-5">
    <div>
      <h1 class="text-2xl font-semibold">Reports</h1>
      <p class="label mt-1">Markdown reports generated from the local index</p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <button v-for="type in reportTypes" :key="type" class="panel p-5 text-left hover:border-[#4b5758]" @click="generate(type)">
        <FileText :size="22" class="mb-4 text-[var(--green)]" />
        <div class="font-semibold capitalize">{{ type }} report</div>
        <div class="label mt-2">Markdown · redacted</div>
      </button>
    </div>

    <div v-if="content" class="panel p-4">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="section-title">{{ filename }}</h2>
        <button class="btn" @click="download">
          <Download :size="16" />
          Download
        </button>
      </div>
      <pre class="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-[#101314] p-4 text-sm leading-6 text-[#d9dfdc]">{{ content }}</pre>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Download, FileText } from "lucide-vue-next";
import { ref } from "vue";
import { client } from "@/lib/api";

const reportTypes = ["weekly", "monthly", "project"];
const content = ref("");
const filename = ref("");

async function generate(type: string) {
  const report = await client.exportReport(type);
  content.value = report.content;
  filename.value = report.filename;
}

function download() {
  const blob = new Blob([content.value], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.value || "ailog-report.md";
  link.click();
  URL.revokeObjectURL(url);
}
</script>

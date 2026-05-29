<template>
  <section class="content-wrap grid gap-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Privacy Center</h1>
        <p class="label mt-1">Sensitive information detection before export or sharing</p>
      </div>
      <button class="btn" @click="load">
        <RefreshCcw :size="16" />
        Refresh
      </button>
    </div>

    <div class="grid-auto">
      <MetricCard label="Findings" :value="findings.length" :icon="ShieldAlert" />
      <MetricCard label="High severity" :value="findings.filter((item) => item.severity === 'high').length" />
      <MetricCard label="Medium severity" :value="findings.filter((item) => item.severity === 'medium').length" />
      <MetricCard label="Low severity" :value="findings.filter((item) => item.severity === 'low').length" />
    </div>

    <div v-if="findings.length" class="grid gap-3">
      <RouterLink v-for="finding in findings" :key="finding.id" :to="finding.messageId ? `/conversations/${finding.conversationId}#${finding.messageId}` : `/conversations/${finding.conversationId}`" class="panel-soft p-4 hover:border-[#4b5758]">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span class="badge">{{ finding.type }}</span>
          <span class="badge">{{ finding.severity }}</span>
          <span class="label mono">{{ finding.sourceFilePath }}</span>
        </div>
        <p class="text-sm leading-6 text-[#cfd7d3]">{{ finding.excerpt }}</p>
      </RouterLink>
    </div>
    <EmptyState v-else title="No sensitive findings" text="The local index did not expose known key/token/email patterns." :icon="ShieldCheck" />
  </section>
</template>

<script setup lang="ts">
import { RefreshCcw, ShieldAlert, ShieldCheck } from "lucide-vue-next";
import { onMounted, ref } from "vue";
import type { SensitiveFinding } from "@ailog/shared";
import EmptyState from "@/components/EmptyState.vue";
import MetricCard from "@/components/MetricCard.vue";
import { client } from "@/lib/api";

const findings = ref<SensitiveFinding[]>([]);
onMounted(load);

async function load() {
  findings.value = await client.sensitive();
}
</script>

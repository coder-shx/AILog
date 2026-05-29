<template>
  <section class="content-wrap grid gap-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Capabilities</h1>
        <p class="label mt-1">Final-version local integrations and extension surfaces</p>
      </div>
      <button class="btn" @click="load">
        <RefreshCcw :size="16" />
        Refresh
      </button>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <div v-for="capability in capabilities" :key="capability.id" class="panel p-4">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 class="section-title">{{ capability.name }}</h2>
            <p class="mt-2 text-sm leading-6 text-[#aeb8b3]">{{ capability.description }}</p>
          </div>
          <span class="badge">{{ capability.status }}</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="badge">{{ capability.localFirst ? "local-first" : "remote" }}</span>
          <span v-if="capability.entry" class="badge mono">{{ capability.entry }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RefreshCcw } from "lucide-vue-next";
import { onMounted, ref } from "vue";
import type { CapabilityStatus } from "@ailog/shared";
import { client } from "@/lib/api";

const capabilities = ref<CapabilityStatus[]>([]);
onMounted(load);

async function load() {
  capabilities.value = await client.capabilities();
}
</script>

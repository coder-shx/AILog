<template>
  <div class="panel metric-card">
    <div class="flex items-center justify-between gap-3">
      <span class="label">{{ label }}</span>
      <component :is="icon" v-if="icon" :size="16" class="text-[var(--muted)]" />
    </div>
    <div class="value">{{ value }}</div>
    <div v-if="hint" class="label">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  hint?: string;
  icon?: unknown;
}>();
</script>

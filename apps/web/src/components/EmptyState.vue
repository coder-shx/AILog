<template>
  <div class="panel grid min-h-[280px] place-items-center p-8 text-center">
    <div>
      <component :is="icon" v-if="icon" :size="34" class="mx-auto mb-4 text-[var(--muted)]" />
      <div class="text-lg font-semibold">{{ title }}</div>
      <div v-if="text" class="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#9da5a2]">{{ text }}</div>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; text?: string; icon?: unknown }>();
</script>

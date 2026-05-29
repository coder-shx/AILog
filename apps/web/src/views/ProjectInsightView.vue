<template>
  <section class="content-wrap grid gap-5">
    <div>
      <h1 class="text-2xl font-semibold">Project Insight</h1>
      <p class="label mt-1">Project-level AI collaboration cost and behavior</p>
    </div>

    <div v-if="projects.length" class="grid gap-4">
      <div v-for="project in projects" :key="project.projectName" class="panel p-4">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="section-title">{{ project.projectName }}</h2>
            <div class="label mt-1">{{ project.conversationCount }} conversations · {{ project.totalTokens }} tokens</div>
          </div>
          <RouterLink class="btn" :to="`/timeline?keyword=${encodeURIComponent(project.projectName)}`">
            <GitCommitHorizontal :size="16" />
            Timeline
          </RouterLink>
        </div>
        <div class="grid gap-4 md:grid-cols-4">
          <div>
            <div class="label mb-2">Intents</div>
            <span v-for="item in project.mainIntents.slice(0, 6)" :key="item.term" class="badge mr-2 mb-2">{{ item.term }} · {{ item.count }}</span>
          </div>
          <div>
            <div class="label mb-2">Prompt Words</div>
            <span v-for="item in project.topPromptWords.slice(0, 8)" :key="item.term" class="badge mr-2 mb-2">{{ item.term }}</span>
          </div>
          <div>
            <div class="label mb-2">Models</div>
            <span v-for="item in project.topModels.slice(0, 6)" :key="item.term" class="badge mr-2 mb-2">{{ item.term }}</span>
          </div>
          <div>
            <div class="label mb-2">Files</div>
            <div v-for="item in project.topFiles.slice(0, 5)" :key="item.term" class="truncate text-sm leading-6 text-[#cfd7d3]">{{ item.term }}</div>
          </div>
        </div>
      </div>
    </div>
    <EmptyState v-else title="No projects indexed" text="Scan local history to build project insights." :icon="Workflow" />
  </section>
</template>

<script setup lang="ts">
import { GitCommitHorizontal, Workflow } from "lucide-vue-next";
import { computed } from "vue";
import EmptyState from "@/components/EmptyState.vue";
import { useAILogStore } from "@/stores/ailog";

const store = useAILogStore();
const projects = computed(() => store.projects);
</script>

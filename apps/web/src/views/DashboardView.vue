<template>
  <section class="content-wrap grid gap-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Dashboard</h1>
        <p class="label mt-1">AI collaboration cockpit</p>
      </div>
      <button class="btn" @click="store.bootstrap()">
        <RefreshCcw :size="16" />
        Refresh
      </button>
    </div>

    <div class="grid-auto">
      <MetricCard label="Conversations" :value="overview?.totalConversations ?? 0" :icon="MessageSquare" />
      <MetricCard label="Messages" :value="overview?.totalMessages ?? 0" :icon="Rows3" />
      <MetricCard label="User prompts" :value="overview?.userPrompts ?? 0" :icon="UserRound" />
      <MetricCard label="AI replies" :value="overview?.assistantReplies ?? 0" :icon="Bot" />
      <MetricCard label="Total tokens" :value="formatNumber(overview?.totalTokens ?? 0)" :icon="Gauge" />
      <MetricCard label="Tool calls" :value="overview?.totalToolCalls ?? 0" :icon="Wrench" />
    </div>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
      <div class="panel p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="section-title">Activity Trend</h2>
          <span class="badge">{{ overview?.dailyActivity.length ?? 0 }} days</span>
        </div>
        <EChartPanel :option="activityOption" />
      </div>

      <div class="panel p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="section-title">Hourly Distribution</h2>
          <span class="badge mono">24h</span>
        </div>
        <EChartPanel :option="hourlyOption" />
      </div>
    </div>

    <div class="grid gap-5 xl:grid-cols-3">
      <div class="panel p-4 xl:col-span-2">
        <h2 class="section-title mb-4">Contribution Heatmap</h2>
        <div class="grid grid-cols-[repeat(30,12px)] gap-1 overflow-auto pb-2">
          <div v-for="day in heatmap" :key="day.date" class="heat-cell" :title="`${day.date}: ${day.count}`" :style="{ background: heatColor(day.count), borderColor: heatColor(day.count) }"></div>
        </div>
      </div>

      <div class="panel p-4">
        <h2 class="section-title mb-4">Top Models</h2>
        <div class="grid gap-3">
          <div v-for="item in overview?.modelCounts.slice(0, 6)" :key="item.term">
            <div class="mb-1 flex justify-between gap-3 text-sm">
              <span class="truncate">{{ item.term }}</span>
              <span class="mono text-[#9da5a2]">{{ item.count }}</span>
            </div>
            <div class="h-2 rounded-full bg-[#242a2b]">
              <div class="h-2 rounded-full bg-[var(--green)]" :style="{ width: barWidth(item.count, overview?.modelCounts[0]?.count ?? 1) }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-5 xl:grid-cols-3">
      <div class="panel p-4">
        <h2 class="section-title mb-4">Projects</h2>
        <div class="grid gap-3">
          <div v-for="item in overview?.projectCounts.slice(0, 8)" :key="item.term" class="flex items-center justify-between gap-3">
            <span class="truncate text-sm">{{ item.term }}</span>
            <span class="badge mono">{{ item.count }}</span>
          </div>
        </div>
      </div>
      <div class="panel p-4">
        <h2 class="section-title mb-4">Prompt Words</h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="item in store.promptInsight?.topWords.slice(0, 20)" :key="item.term" class="badge">{{ item.term }} · {{ item.count }}</span>
        </div>
      </div>
      <div class="panel p-4">
        <h2 class="section-title mb-4">Tool Calls</h2>
        <div class="grid gap-3">
          <div v-for="item in overview?.toolCounts.slice(0, 8)" :key="item.term" class="flex items-center justify-between gap-3">
            <span class="truncate text-sm">{{ item.term }}</span>
            <span class="badge mono">{{ item.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="panel p-4">
      <h2 class="section-title mb-4">Recent Timeline</h2>
      <div v-if="overview?.recentTimeline.length" class="timeline-rail grid gap-1">
        <TimelineItem v-for="conversation in overview.recentTimeline" :key="conversation.id" :conversation="conversation" />
      </div>
      <EmptyState v-else title="No conversations indexed" text="Open Settings to add history directories, then run Scan." :icon="Inbox" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { Bot, Gauge, Inbox, MessageSquare, RefreshCcw, Rows3, UserRound, Wrench } from "lucide-vue-next";
import { computed } from "vue";
import EChartPanel from "@/components/EChartPanel.vue";
import EmptyState from "@/components/EmptyState.vue";
import MetricCard from "@/components/MetricCard.vue";
import TimelineItem from "@/components/TimelineItem.vue";
import { useAILogStore } from "@/stores/ailog";

const store = useAILogStore();
const overview = computed(() => store.overview);

const activityOption = computed(() => ({
  backgroundColor: "transparent",
  tooltip: { trigger: "axis" },
  grid: { left: 36, right: 18, top: 20, bottom: 28 },
  xAxis: { type: "category", data: overview.value?.dailyActivity.map((item) => item.date.slice(5)) ?? [], axisLine: { lineStyle: { color: "#3a4243" } } },
  yAxis: { type: "value", splitLine: { lineStyle: { color: "#252b2c" } } },
  series: [
    {
      type: "line",
      smooth: true,
      data: overview.value?.dailyActivity.map((item) => item.count) ?? [],
      areaStyle: { color: "rgba(94,224,142,0.12)" },
      lineStyle: { color: "#5ee08e", width: 2 },
      symbolSize: 6
    }
  ]
}));

const hourlyOption = computed(() => ({
  backgroundColor: "transparent",
  tooltip: { trigger: "axis" },
  grid: { left: 30, right: 10, top: 20, bottom: 28 },
  xAxis: { type: "category", data: overview.value?.hourlyActivity.map((item) => `${item.hour}`) ?? [] },
  yAxis: { type: "value", splitLine: { lineStyle: { color: "#252b2c" } } },
  series: [{ type: "bar", data: overview.value?.hourlyActivity.map((item) => item.count) ?? [], itemStyle: { color: "#52c7e8", borderRadius: 3 } }]
}));

const heatmap = computed(() => {
  const map = new Map((overview.value?.dailyActivity ?? []).map((item) => [item.date, item]));
  const days = [];
  for (let index = 89; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    days.push({ date: key, count: map.get(key)?.count ?? 0 });
  }
  return days;
});

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function barWidth(value: number, max: number) {
  return `${Math.max(4, Math.round((value / Math.max(1, max)) * 100))}%`;
}

function heatColor(count: number) {
  if (count <= 0) return "#202526";
  if (count === 1) return "#245236";
  if (count <= 3) return "#2f7d4b";
  if (count <= 6) return "#45b66d";
  return "#5ee08e";
}
</script>

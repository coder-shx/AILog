<template>
  <section class="content-wrap grid gap-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Prompt Insight</h1>
        <p class="label mt-1">Prompt Intelligence from local history</p>
      </div>
      <span class="badge mono">Q {{ insight?.qualityAverage?.total ?? 0 }}</span>
    </div>

    <div class="grid-auto">
      <MetricCard label="Prompts" :value="insight?.totalPrompts ?? 0" :icon="MessageSquareText" />
      <MetricCard label="Average length" :value="insight?.averageLength ?? 0" :icon="Ruler" />
      <MetricCard label="Median length" :value="insight?.medianLength ?? 0" :icon="BetweenHorizontalStart" />
      <MetricCard label="Question ratio" :value="percent(insight?.questionRatio ?? 0)" :icon="CircleHelp" />
      <MetricCard label="Command ratio" :value="percent(insight?.imperativeRatio ?? 0)" :icon="TerminalSquare" />
      <MetricCard label="Code block ratio" :value="percent(insight?.codeBlockRatio ?? 0)" :icon="Code2" />
    </div>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div class="panel p-4">
        <h2 class="section-title mb-4">Intent Distribution</h2>
        <EChartPanel :option="intentOption" />
      </div>
      <div class="panel p-4">
        <h2 class="section-title mb-4">Language Ratio</h2>
        <div class="grid gap-3">
          <RatioRow label="中文" :value="insight?.languageRatio.zh ?? 0" />
          <RatioRow label="English" :value="insight?.languageRatio.en ?? 0" />
          <RatioRow label="Mixed" :value="insight?.languageRatio.mixed ?? 0" />
          <RatioRow label="Other" :value="insight?.languageRatio.other ?? 0" />
        </div>
      </div>
    </div>

    <div class="grid gap-5 xl:grid-cols-3">
      <div class="panel p-4">
        <h2 class="section-title mb-4">Top Words</h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="item in insight?.topWords.slice(0, 35)" :key="item.term" class="badge">{{ item.term }} · {{ item.count }}</span>
        </div>
      </div>
      <div class="panel p-4">
        <h2 class="section-title mb-4">Tech Terms</h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="item in insight?.topTechTerms.slice(0, 35)" :key="item.term" class="badge">{{ item.term }} · {{ item.count }}</span>
        </div>
      </div>
      <div class="panel p-4">
        <h2 class="section-title mb-4">Missing Signals</h2>
        <div class="grid gap-3">
          <div v-for="[name, count] in missingSignals" :key="name" class="flex items-center justify-between">
            <span class="text-sm">{{ name }}</span>
            <span class="badge mono">{{ count }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-5 xl:grid-cols-2">
      <PromptList title="High Quality Prompts" :items="insight?.highQualityPrompts ?? []" />
      <PromptList title="Low Quality Prompts" :items="insight?.lowQualityPrompts ?? []" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { BetweenHorizontalStart, CircleHelp, Code2, MessageSquareText, Ruler, TerminalSquare } from "lucide-vue-next";
import { computed, defineComponent, h } from "vue";
import type { AILogMessage } from "@ailog/shared";
import EChartPanel from "@/components/EChartPanel.vue";
import MetricCard from "@/components/MetricCard.vue";
import { useAILogStore } from "@/stores/ailog";

const store = useAILogStore();
const insight = computed(() => store.promptInsight);

const intentOption = computed(() => {
  const counts = (insight.value?.intentCounts ?? {}) as Record<string, number>;
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "item" },
    series: [
      {
        type: "pie",
        radius: ["42%", "70%"],
        data: Object.entries(counts)
          .filter(([, value]) => value > 0)
          .map(([name, value]) => ({ name, value })),
        itemStyle: { borderRadius: 4, borderColor: "#151819", borderWidth: 2 }
      }
    ]
  };
});

const missingSignals = computed(() => Object.entries(insight.value?.missingSignalCounts ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 10));

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

const RatioRow = defineComponent({
  props: { label: { type: String, required: true }, value: { type: Number, required: true } },
  setup(props) {
    return () =>
      h("div", {}, [
        h("div", { class: "mb-1 flex justify-between text-sm" }, [h("span", props.label), h("span", { class: "mono text-[#9da5a2]" }, `${Math.round(props.value * 100)}%`)]),
        h("div", { class: "h-2 rounded-full bg-[#242a2b]" }, [
          h("div", { class: "h-2 rounded-full bg-[var(--cyan)]", style: { width: `${Math.max(2, props.value * 100)}%` } })
        ])
      ]);
  }
});

const PromptList = defineComponent({
  props: { title: { type: String, required: true }, items: { type: Array as () => AILogMessage[], required: true } },
  setup(props) {
    return () =>
      h("div", { class: "panel p-4" }, [
        h("h2", { class: "section-title mb-4" }, props.title),
        h(
          "div",
          { class: "grid gap-3" },
          props.items.map((item) =>
            h("div", { class: "rounded-md border border-[var(--line)] bg-[#101314] p-3" }, [
              h("div", { class: "mb-2 flex items-center gap-2" }, [
                h("span", { class: "badge" }, item.promptIntent ?? "other"),
                h("span", { class: "badge mono" }, `Q ${item.promptQuality?.total ?? 0}`)
              ]),
              h("p", { class: "text-sm leading-6 text-[#cfd7d3]" }, item.content.slice(0, 260))
            ])
          )
        )
      ]);
  }
});
</script>

<template>
  <div ref="container" class="h-full min-h-[240px] w-full"></div>
</template>

<script setup lang="ts">
import * as echarts from "echarts";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{ option: Record<string, unknown> }>();
const container = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function render() {
  if (!container.value) return;
  chart ??= echarts.init(container.value, "dark");
  chart.setOption(props.option as echarts.EChartsOption, true);
}

onMounted(() => {
  render();
  window.addEventListener("resize", resize);
});

watch(() => props.option, render, { deep: true });

onBeforeUnmount(() => {
  window.removeEventListener("resize", resize);
  chart?.dispose();
});

function resize() {
  chart?.resize();
}
</script>

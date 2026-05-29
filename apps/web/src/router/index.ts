import { createRouter, createWebHistory } from "vue-router";
import DashboardView from "@/views/DashboardView.vue";
import TimelineView from "@/views/TimelineView.vue";
import ConversationView from "@/views/ConversationView.vue";
import SearchView from "@/views/SearchView.vue";
import PromptInsightView from "@/views/PromptInsightView.vue";
import ProjectInsightView from "@/views/ProjectInsightView.vue";
import CompareView from "@/views/CompareView.vue";
import PromptLibraryView from "@/views/PromptLibraryView.vue";
import ReportsView from "@/views/ReportsView.vue";
import SettingsView from "@/views/SettingsView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "dashboard", component: DashboardView },
    { path: "/timeline", name: "timeline", component: TimelineView },
    { path: "/conversations/:id", name: "conversation", component: ConversationView },
    { path: "/search", name: "search", component: SearchView },
    { path: "/prompts", name: "prompts", component: PromptInsightView },
    { path: "/projects", name: "projects", component: ProjectInsightView },
    { path: "/compare", name: "compare", component: CompareView },
    { path: "/library", name: "library", component: PromptLibraryView },
    { path: "/reports", name: "reports", component: ReportsView },
    { path: "/settings", name: "settings", component: SettingsView }
  ]
});

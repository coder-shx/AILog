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
import PrivacyView from "@/views/PrivacyView.vue";
import LiveSessionsView from "@/views/LiveSessionsView.vue";
import CapabilitiesView from "@/views/CapabilitiesView.vue";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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
    { path: "/privacy", name: "privacy", component: PrivacyView },
    { path: "/live", name: "live", component: LiveSessionsView },
    { path: "/capabilities", name: "capabilities", component: CapabilitiesView },
    { path: "/settings", name: "settings", component: SettingsView }
  ]
});

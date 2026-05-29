import { defineStore } from "pinia";
import type { AILogConversation, AILogSettings, OverviewStats, ProjectInsight, PromptInsight } from "@ailog/shared";
import { client } from "@/lib/api";

interface AILogState {
  loading: boolean;
  error: string | null;
  conversations: AILogConversation[];
  overview: OverviewStats | null;
  promptInsight: PromptInsight | null;
  projects: ProjectInsight[];
  settings: AILogSettings | null;
}

export const useAILogStore = defineStore("ailog", {
  state: (): AILogState => ({
    loading: false,
    error: null,
    conversations: [],
    overview: null,
    promptInsight: null,
    projects: [],
    settings: null
  }),
  actions: {
    async bootstrap() {
      this.loading = true;
      this.error = null;
      try {
        const [settings, overview, conversations, promptInsight, projects] = await Promise.all([
          client.settings(),
          client.overview(),
          client.conversations({ sort: "newest" }),
          client.promptInsight(),
          client.projects()
        ]);
        this.settings = settings;
        this.overview = overview;
        this.conversations = conversations;
        this.promptInsight = promptInsight;
        this.projects = projects;
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.loading = false;
      }
    },
    async refreshConversations() {
      this.conversations = await client.conversations({ sort: "newest" });
    },
    async scan() {
      this.loading = true;
      this.error = null;
      try {
        await client.scan();
        await this.bootstrap();
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.loading = false;
      }
    },
    async saveSettings(settings: AILogSettings) {
      this.settings = await client.saveSettings(settings);
    }
  }
});

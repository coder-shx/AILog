const vscode = require("vscode");

const AILOG_URL = "http://127.0.0.1:1420";
const API_URL = "http://127.0.0.1:1421";

function activate(context) {
  const provider = new AILogTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("ailog.explorer", provider),
    vscode.commands.registerCommand("ailog.open", () => {
      vscode.env.openExternal(vscode.Uri.parse(AILOG_URL));
    }),
    vscode.commands.registerCommand("ailog.search", async () => {
      const query = await vscode.window.showInputBox({ prompt: "Search AILog local history" });
      if (!query) return;
      vscode.env.openExternal(vscode.Uri.parse(`${AILOG_URL}/search?q=${encodeURIComponent(query)}`));
    }),
    vscode.commands.registerCommand("ailog.refresh", () => provider.refresh())
  );
}

class AILogTreeProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.items = [];
    void this.refresh();
  }

  refresh() {
    void this.load();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item) {
    return item;
  }

  getChildren() {
    return this.items;
  }

  async load() {
    try {
      const stats = await getJson(`${API_URL}/api/stats/overview`);
      this.items = [
        treeItem("Open AILog Console", "ailog.open", "rocket"),
        treeItem("Search Local History", "ailog.search", "search"),
        infoItem(`Conversations: ${stats.totalConversations ?? 0}`),
        infoItem(`Messages: ${stats.totalMessages ?? 0}`),
        infoItem(`Tool calls: ${stats.totalToolCalls ?? 0}`),
        infoItem(`Top project: ${stats.topProject ?? "N/A"}`)
      ];
    } catch {
      this.items = [treeItem("Start AILog, then refresh", "ailog.open", "warning"), treeItem("Refresh Stats", "ailog.refresh", "refresh")];
    }
    this._onDidChangeTreeData.fire();
  }
}

function treeItem(label, command, icon) {
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
  item.command = { command, title: label };
  item.iconPath = new vscode.ThemeIcon(icon);
  return item;
}

function infoItem(label) {
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon("graph");
  return item;
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function deactivate() {}

module.exports = { activate, deactivate };

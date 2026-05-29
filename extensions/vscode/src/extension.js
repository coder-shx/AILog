const vscode = require("vscode");

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("ailog.open", () => {
      vscode.env.openExternal(vscode.Uri.parse("http://127.0.0.1:1420"));
    }),
    vscode.commands.registerCommand("ailog.search", async () => {
      const query = await vscode.window.showInputBox({ prompt: "Search AILog local history" });
      if (!query) return;
      vscode.env.openExternal(vscode.Uri.parse(`http://127.0.0.1:1420/search?q=${encodeURIComponent(query)}`));
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };

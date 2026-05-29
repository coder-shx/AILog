const statusEl = document.getElementById("status");

document.getElementById("open").addEventListener("click", () => {
  chrome.tabs.create({ url: "http://127.0.0.1:1420" });
});

document.getElementById("save").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return setStatus("No active tab found.");
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      title: document.title,
      url: location.href,
      text: window.getSelection()?.toString() || document.body.innerText.slice(0, 12000)
    })
  });
  const now = new Date().toISOString();
  const markdown = [
    "# Browser Import",
    "",
    `- Title: ${result.title || tab.title || "Untitled"}`,
    `- URL: ${result.url || tab.url || ""}`,
    `- Captured: ${now}`,
    "",
    "## User",
    "",
    "Please review this imported web context.",
    "",
    "## Assistant",
    "",
    result.text || ""
  ].join("\n");
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
  await chrome.downloads.download({
    url,
    filename: `ailog-import/browser-${now.slice(0, 10)}-${sanitize(result.title || "page")}.md`,
    saveAs: false
  });
  setStatus("Downloaded to ailog-import.");
});

function setStatus(value) {
  statusEl.textContent = value;
}

function sanitize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "page";
}

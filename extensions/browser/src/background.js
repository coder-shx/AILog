chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    ailogApiBase: "http://127.0.0.1:1421",
    localOnly: true
  });
});

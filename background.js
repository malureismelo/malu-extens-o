chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_STATE") {
    chrome.storage.local.get(["running"], (res) => {
      sendResponse(res.running);
    });
    return true;
  }

  if (msg.type === "SET_STATE") {
    chrome.storage.local.set({ running: msg.value });
  }
});
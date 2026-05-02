const statusEl = document.getElementById("status");
const daysEl = document.getElementById("days");
const autoModeEl = document.getElementById("autoMode");

chrome.storage.local.get(["running", "maxDays", "autoMode"], (res) => {
  statusEl.textContent = res.running ? "Rodando" : "Parado";
  if (typeof res.maxDays === "number") daysEl.value = res.maxDays;
  autoModeEl.checked = !!res.autoMode;
});

document.getElementById("start").addEventListener("click", () => {
  const days = parseInt(daysEl.value || "2", 10);

  chrome.storage.local.set({
    running: true,
    maxDays: days,
    autoMode: autoModeEl.checked
  }, () => {
    statusEl.textContent = "Rodando";
  });
});

document.getElementById("stop").addEventListener("click", () => {
  chrome.storage.local.set({
    running: false
  }, () => {
    statusEl.textContent = "Parado";
  });
});

document.getElementById("openSettings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

autoModeEl.addEventListener("change", () => {
  chrome.storage.local.set({
    autoMode: autoModeEl.checked
  });
});

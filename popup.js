const statusEl = document.getElementById("status");
const daysEl = document.getElementById("days");

chrome.storage.local.get(["running", "maxDays"], (res) => {
  statusEl.textContent = res.running ? "Rodando" : "Parado";
  if (typeof res.maxDays === "number") daysEl.value = res.maxDays;
});

document.getElementById("start").addEventListener("click", () => {
  const days = parseInt(daysEl.value || "2", 10);

  chrome.storage.local.set({
    running: true,
    maxDays: days
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

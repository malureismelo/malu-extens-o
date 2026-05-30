const statusEl = document.getElementById("status");
const daysEl = document.getElementById("days");
const autoModeEl = document.getElementById("autoMode");
const repeatCycleEnabledEl = document.getElementById("repeatCycleEnabled");

function getStatusText(res) {
  if (res.running) return "Rodando";

  if (
    res.repeatCycleEnabled &&
    typeof res.scheduledRestartAt === "number" &&
    res.scheduledRestartAt > Date.now()
  ) {
    return "Pausado 10 min";
  }

  return "Parado";
}

function refreshStatus() {
  chrome.storage.local.get(
    ["running", "repeatCycleEnabled", "scheduledRestartAt"],
    (res) => {
      statusEl.textContent = getStatusText(res);
    }
  );
}

chrome.storage.local.get(
  ["running", "maxDays", "autoMode", "repeatCycleEnabled", "scheduledRestartAt"],
  (res) => {
    statusEl.textContent = getStatusText(res);
    if (typeof res.maxDays === "number") daysEl.value = res.maxDays;
    autoModeEl.checked = !!res.autoMode;
    repeatCycleEnabledEl.checked = !!res.repeatCycleEnabled;
  }
);

document.getElementById("start").addEventListener("click", () => {
  const days = parseInt(daysEl.value || "2", 10);

  chrome.storage.local.set({
    running: true,
    maxDays: days,
    autoMode: autoModeEl.checked,
    repeatCycleEnabled: repeatCycleEnabledEl.checked,
    cycleSentCount: 0,
    scheduledRestartAt: null
  }, () => {
    statusEl.textContent = "Rodando";
  });

  chrome.runtime.sendMessage({
    type: "MANUAL_START"
  });
});

document.getElementById("stop").addEventListener("click", () => {
  chrome.storage.local.set({
    running: false,
    scheduledRestartAt: null
  }, () => {
    statusEl.textContent = "Parado";
  });

  chrome.runtime.sendMessage({
    type: "MANUAL_STOP"
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

repeatCycleEnabledEl.addEventListener("change", () => {
  chrome.storage.local.set({
    repeatCycleEnabled: repeatCycleEnabledEl.checked
  }, () => {
    refreshStatus();
  });

  if (!repeatCycleEnabledEl.checked) {
    chrome.runtime.sendMessage({
      type: "CANCEL_REPEAT_CYCLE"
    });
  }
});

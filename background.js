var RESTART_ALARM_NAME = "restart-automation-cycle";
var RESTART_DELAY_MINUTES = 10;
var DEFAULT_PROJECTS_URL =
  "https://www.99freelas.com.br/projects?categoria=web-mobile-e-software";

function buildNotificationMessage(sentCount, shouldRepeat) {
  var countLabel = sentCount === 1 ? "1 mensagem enviada" : sentCount + " mensagens enviadas";

  if (shouldRepeat) {
    return countLabel + ". Proximo ciclo em 10 minutos.";
  }

  return countLabel + ".";
}

function normalizeProjectsUrl(url) {
  try {
    var parsedUrl = new URL(url || DEFAULT_PROJECTS_URL);
    parsedUrl.searchParams.delete("page");
    return parsedUrl.toString();
  } catch (e) {
    return DEFAULT_PROJECTS_URL;
  }
}

function buildRestartUrl(url) {
  try {
    var parsedUrl = new URL(url || DEFAULT_PROJECTS_URL);
    parsedUrl.searchParams.set("page", "1");
    return parsedUrl.toString();
  } catch (e) {
    return DEFAULT_PROJECTS_URL;
  }
}

function isProjectsListUrl(url) {
  try {
    return new URL(url).pathname === "/projects";
  } catch (e) {
    return false;
  }
}

async function clearRestartSchedule() {
  await chrome.alarms.clear(RESTART_ALARM_NAME);
  await chrome.storage.local.remove("scheduledRestartAt");
}

async function showCycleCompleteNotification(sentCount, shouldRepeat) {
  await chrome.notifications.create("cycle-complete-" + Date.now(), {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Automacao finalizada",
    message: buildNotificationMessage(sentCount, shouldRepeat),
    priority: 2
  });
}

async function scheduleRestart(baseUrl) {
  var when = Date.now() + RESTART_DELAY_MINUTES * 60 * 1000;

  await chrome.alarms.create(RESTART_ALARM_NAME, { when: when });
  await chrome.storage.local.set({
    scheduledRestartAt: when,
    automationBaseUrl: normalizeProjectsUrl(baseUrl)
  });
}

async function getRegisteredTabId() {
  var data = await chrome.storage.local.get("automationTabId");
  return typeof data.automationTabId === "number" ? data.automationTabId : null;
}

async function resolveAutomationTab(baseUrl) {
  var normalizedBaseUrl = normalizeProjectsUrl(baseUrl);
  var registeredTabId = await getRegisteredTabId();

  if (registeredTabId !== null) {
    try {
      var registeredTab = await chrome.tabs.get(registeredTabId);

      if (normalizeProjectsUrl(registeredTab.url) === normalizedBaseUrl) {
        return registeredTab;
      }
    } catch (e) {
    }

    await chrome.storage.local.remove("automationTabId");
  }

  var tabs = await chrome.tabs.query({
    url: "https://www.99freelas.com.br/*"
  });

  if (!tabs.length) return null;

  for (var i = 0; i < tabs.length; i++) {
    if (normalizeProjectsUrl(tabs[i].url) === normalizedBaseUrl) {
      return tabs[i];
    }
  }

  for (var j = 0; j < tabs.length; j++) {
    if (isProjectsListUrl(tabs[j].url)) {
      return tabs[j];
    }
  }

  return null;
}

async function restartAutomationCycle() {
  var data = await chrome.storage.local.get([
    "repeatCycleEnabled",
    "automationBaseUrl"
  ]);

  if (!data.repeatCycleEnabled) {
    await clearRestartSchedule();
    return;
  }

  var restartUrl = buildRestartUrl(data.automationBaseUrl);
  var tab = await resolveAutomationTab(restartUrl);

  await chrome.storage.local.set({
    running: true,
    cycleSentCount: 0,
    scheduledRestartAt: null,
    pendingProject: null,
    returnAfterSubmit: null,
    automationBaseUrl: normalizeProjectsUrl(restartUrl)
  });

  if (tab) {
    await chrome.storage.local.set({ automationTabId: tab.id });

    if (tab.url === restartUrl) {
      await chrome.tabs.reload(tab.id);
    } else {
      await chrome.tabs.update(tab.id, { url: restartUrl });
    }
  } else {
    var createdTab = await chrome.tabs.create({
      url: restartUrl,
      active: false
    });

    await chrome.storage.local.set({ automationTabId: createdTab.id });
  }
}

async function handleCycleComplete(msg, sender) {
  var sentCount = typeof msg.sentCount === "number" ? msg.sentCount : 0;
  var baseUrl = normalizeProjectsUrl(msg.baseUrl);
  var data = await chrome.storage.local.get("repeatCycleEnabled");
  var shouldRepeat = !!data.repeatCycleEnabled;

  await chrome.storage.local.set({
    automationBaseUrl: baseUrl
  });

  if (sender.tab && typeof sender.tab.id === "number") {
    await chrome.storage.local.set({
      automationTabId: sender.tab.id
    });
  }

  await showCycleCompleteNotification(sentCount, shouldRepeat);

  if (shouldRepeat) {
    await scheduleRestart(baseUrl);
    return;
  }

  await clearRestartSchedule();
}

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name !== RESTART_ALARM_NAME) return;

  restartAutomationCycle().catch(function(error) {
    console.error("Erro ao reiniciar automacao:", error);
  });
});

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === "GET_STATE") {
    chrome.storage.local.get(["running"], function(res) {
      sendResponse(res.running);
    });
    return true;
  }

  if (msg.type === "SET_STATE") {
    chrome.storage.local.set({ running: msg.value });
    return false;
  }

  if (msg.type === "REGISTER_AUTOMATION_TAB") {
    chrome.storage.local
      .set({
        automationBaseUrl: normalizeProjectsUrl(msg.baseUrl),
        automationTabId: sender.tab && typeof sender.tab.id === "number"
          ? sender.tab.id
          : null
      })
      .then(function() {
        sendResponse({ ok: true });
      })
      .catch(function(error) {
        console.error("Erro ao registrar aba da automacao:", error);
        sendResponse({ ok: false });
      });
    return true;
  }

  if (msg.type === "MANUAL_START") {
    clearRestartSchedule()
      .then(function() {
        sendResponse({ ok: true });
      })
      .catch(function(error) {
        console.error("Erro ao limpar agendamento:", error);
        sendResponse({ ok: false });
      });
    return true;
  }

  if (msg.type === "MANUAL_STOP" || msg.type === "CANCEL_REPEAT_CYCLE") {
    clearRestartSchedule()
      .then(function() {
        sendResponse({ ok: true });
      })
      .catch(function(error) {
        console.error("Erro ao cancelar agendamento:", error);
        sendResponse({ ok: false });
      });
    return true;
  }

  if (msg.type === "CYCLE_COMPLETE") {
    handleCycleComplete(msg, sender)
      .then(function() {
        sendResponse({ ok: true });
      })
      .catch(function(error) {
        console.error("Erro ao finalizar ciclo:", error);
        sendResponse({ ok: false });
      });
    return true;
  }
});

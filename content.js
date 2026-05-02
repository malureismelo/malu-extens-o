console.log("99freelas content.js carregou");

var DAY_MS = 24 * 60 * 60 * 1000;

function sleep(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMaxDays(value) {
  var days = parseInt(value, 10);

  if (isNaN(days) || days < 0) {
    return 0;
  }

  return days;
}

function parsePublishedAt(text, referenceNow) {
  var normalized = normalizeText(text).replace(/^publicado:\s*/, "");

  if (!normalized) return null;

  var exactDateMatch = normalized.match(
    /(\d{2})\/(\d{2})\/(\d{4})(?:\D+(\d{2}):(\d{2}))?/
  );

  if (exactDateMatch) {
    var day = parseInt(exactDateMatch[1], 10);
    var month = parseInt(exactDateMatch[2], 10) - 1;
    var year = parseInt(exactDateMatch[3], 10);
    var hours = parseInt(exactDateMatch[4] || "0", 10);
    var minutes = parseInt(exactDateMatch[5] || "0", 10);

    return new Date(year, month, day, hours, minutes, 0, 0);
  }

  var relativeMatch = normalized.match(
    /(\d+)\s+(minuto|minutos|hora|horas|dia|dias)(?:\s+atras)?/
  );

  if (!relativeMatch) return null;

  var amount = parseInt(relativeMatch[1], 10);
  var unit = relativeMatch[2];
  var publishedAt = new Date(referenceNow.getTime());

  if (unit.indexOf("minuto") === 0) {
    publishedAt.setMinutes(publishedAt.getMinutes() - amount);
    return publishedAt;
  }

  if (unit.indexOf("hora") === 0) {
    publishedAt.setHours(publishedAt.getHours() - amount);
    return publishedAt;
  }

  publishedAt.setDate(publishedAt.getDate() - amount);
  return publishedAt;
}

function isWithinWindow(publishedAt, referenceNow, maxDays) {
  if (!publishedAt || isNaN(publishedAt.getTime())) return false;

  var diffMs = referenceNow.getTime() - publishedAt.getTime();

  if (diffMs < 0) {
    diffMs = 0;
  }

  if (maxDays <= 0) {
    return diffMs < DAY_MS;
  }

  return diffMs <= maxDays * DAY_MS;
}

function isWordPress(skills, description, title) {
  var text = (skills + " " + description + " " + title).toLowerCase();

  return (
    text.indexOf("wordpress") !== -1 ||
    text.indexOf("wix") !== -1 ||
    text.indexOf("elementor") !== -1
  );
}

function isViewed(project) {
  return !!project.querySelector(".icon-eye");
}

function isProjectsListPage(url) {
  try {
    return new URL(url).pathname === "/projects";
  } catch (e) {
    return url.indexOf("/projects") !== -1;
  }
}

function isMessagePage(url) {
  return url.indexOf("/project/message/") !== -1;
}

function isProjectDetailsPage(url) {
  return url.indexOf("/project/") !== -1 && !isMessagePage(url);
}

function getDocumentHeight() {
  return Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
}

function buildPageUrl(pageNumber) {
  var url = new URL(window.location.href);
  url.searchParams.set("page", String(pageNumber));
  return url.toString();
}

async function isAutoModeEnabled() {
  var data = await chrome.storage.local.get("autoMode");
  return !!data.autoMode;
}

async function notifyUser(message) {
  if (await isAutoModeEnabled()) {
    console.log(message);
    return;
  }

  alert(message);
}

async function requestApproval(message) {
  if (await isAutoModeEnabled()) {
    console.log("Modo automatico ativo, confirmacao ignorada.");
    return true;
  }

  return confirm(message);
}

function findNextPageNumber() {
  var selectedEl = document.querySelector(
    ".pagination-component .page-item.selected[data-page]"
  );
  var currentUrl = new URL(window.location.href);
  var currentPage = selectedEl
    ? parseInt(selectedEl.getAttribute("data-page"), 10)
    : parseInt(currentUrl.searchParams.get("page") || "1", 10);

  if (isNaN(currentPage)) {
    currentPage = 1;
  }

  var pageEls = Array.prototype.slice.call(
    document.querySelectorAll(".pagination-component .page-item[data-page]")
  );
  var nextPageNumber = null;

  for (var i = 0; i < pageEls.length; i++) {
    var pageNumber = parseInt(pageEls[i].getAttribute("data-page"), 10);

    if (isNaN(pageNumber) || pageNumber <= currentPage) continue;

    if (nextPageNumber === null || pageNumber < nextPageNumber) {
      nextPageNumber = pageNumber;
    }
  }

  return nextPageNumber;
}

async function finishAutomation(message) {
  await chrome.storage.local.set({ running: false });
  await chrome.storage.local.remove(["pendingProject", "returnAfterSubmit"]);
  await notifyUser(message);
}

async function maybeReturnToProjectsList() {
  var data = await chrome.storage.local.get([
    "running",
    "returnAfterSubmit"
  ]);

  if (!data.running || !data.returnAfterSubmit) return false;

  var currentUrl = window.location.href;

  if (isMessagePage(currentUrl)) return false;

  if (currentUrl === data.returnAfterSubmit) {
    await chrome.storage.local.remove("returnAfterSubmit");
    return false;
  }

  window.location.href = data.returnAfterSubmit;
  return true;
}

async function scrollToLoadProjects() {
  var previousHeight = 0;
  var stablePasses = 0;
  var attempts = 0;

  while (attempts < 20 && stablePasses < 2) {
    var state = await chrome.storage.local.get("running");
    if (!state.running) return false;

    window.scrollTo(0, getDocumentHeight());
    await sleep(900);

    var currentHeight = getDocumentHeight();

    if (currentHeight === previousHeight) {
      stablePasses += 1;
    } else {
      stablePasses = 0;
      previousHeight = currentHeight;
    }

    attempts += 1;
  }

  await sleep(300);
  return true;
}

function collectProjectData(projectEl, processedSet, maxDays, referenceNow) {
  var id = projectEl.getAttribute("data-id");
  var titleEl = projectEl.querySelector("h1 a");
  var descEl = projectEl.querySelector(".item-text.description");
  var publishedEl = projectEl.querySelector(".datetime");
  var skillEls = projectEl.querySelectorAll(".habilidade");
  var skills = "";

  for (var i = 0; i < skillEls.length; i++) {
    skills += skillEls[i].innerText + " ";
  }

  skills = skills.trim();

  var title = titleEl ? titleEl.innerText.trim() : "";
  var description = descEl ? descEl.innerText.trim() : "";
  var publishedText = publishedEl ? publishedEl.innerText.trim() : "";
  var publishedAt = parsePublishedAt(publishedText, referenceNow);
  var withinWindow = isWithinWindow(publishedAt, referenceNow, maxDays);
  var viewed = isViewed(projectEl);
  var alreadyProcessed = !!id && processedSet.has(id);
  var blockedByWordPress = isWordPress(skills, description, title);

  return {
    id: id,
    href: titleEl ? titleEl.href : "",
    title: title,
    description: description,
    skills: skills,
    publishedText: publishedText,
    publishedAt: publishedAt,
    withinWindow: withinWindow,
    viewed: viewed,
    alreadyProcessed: alreadyProcessed,
    blockedByWordPress: blockedByWordPress
  };
}

async function generateMessage(apiKey, customPrompt, project) {
  try {
    var prompt =
      (customPrompt ||
        "Crie uma mensagem curta, natural e personalizada para este projeto freelance.") +
      "\n\n" +
      "Titulo: " + project.title + "\n" +
      "Descricao: " + project.description;

    var res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7
      })
    });

    var data = await res.json();

    if (!res.ok) {
      await notifyUser(
        "Erro OpenAI: " +
        ((data.error && data.error.message) || "Erro desconhecido")
      );
      return "";
    }

    return (
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) || "";
  } catch (e) {
    console.error("Erro OpenAI:", e);
    await notifyUser("Erro ao conectar com OpenAI.");
    return "";
  }
}

async function startAutomation() {
  console.log("Entrou em startAutomation");

  var data = await chrome.storage.local.get([
    "apiKey",
    "maxDays",
    "running",
    "processed"
  ]);

  var apiKey = data.apiKey;
  var maxDays =
    typeof data.maxDays === "number" ? parseMaxDays(data.maxDays) : 2;
  var running = data.running || false;
  var processed = data.processed || [];

  if (!running) return;

  if (!apiKey) {
    await chrome.storage.local.set({ running: false });
    await notifyUser("Defina sua OpenAI API Key.");
    return;
  }

  var shouldContinue = await scrollToLoadProjects();
  if (!shouldContinue) return;

  var state = await chrome.storage.local.get("running");
  if (!state.running) return;

  var processedSet = new Set(processed);
  var referenceNow = new Date();
  var projectEls = Array.prototype.slice.call(
    document.querySelectorAll("li.result-item")
  );
  var projects = [];
  var hasProjectWithinWindow = false;

  for (var i = 0; i < projectEls.length; i++) {
    var projectData = collectProjectData(
      projectEls[i],
      processedSet,
      maxDays,
      referenceNow
    );

    projects.push(projectData);

    if (projectData.withinWindow) {
      hasProjectWithinWindow = true;
    }
  }

  console.log("Projetos carregados:", projects.length);

  for (var p = 0; p < projects.length; p++) {
    var project = projects[p];
    var currentState = await chrome.storage.local.get("running");

    if (!currentState.running) return;

    if (!project.id) continue;

    if (project.blockedByWordPress) {
      processedSet.add(project.id);
      await chrome.storage.local.set({
        processed: Array.from(processedSet)
      });
      continue;
    }

    if (!project.withinWindow) continue;
    if (project.alreadyProcessed || project.viewed) continue;

    processedSet.add(project.id);

    await chrome.storage.local.set({
      processed: Array.from(processedSet),
      pendingProject: {
        id: project.id,
        title: project.title,
        description: project.description
      },
      lastListUrl: window.location.href
    });

    if (project.href) {
      window.location.href = project.href;
      return;
    }
  }

  var nextPageNumber = findNextPageNumber();

  if (hasProjectWithinWindow) {
    if (nextPageNumber !== null) {
      window.location.href = buildPageUrl(nextPageNumber);
      return;
    }

    await finishAutomation(
      "Automacao finalizada. Todos os projetos dentro do limite ja foram vistos ou processados e nao ha proxima pagina."
    );
    return;
  }

  if (projects.length > 0) {
    await finishAutomation(
      "Automacao finalizada. Nenhum projeto desta pagina esta dentro do limite de dias escolhido."
    );
    return;
  }

  if (nextPageNumber !== null) {
    window.location.href = buildPageUrl(nextPageNumber);
    return;
  }

  await finishAutomation(
    "Automacao finalizada. Nao foi possivel encontrar mais projetos ou paginas."
  );
}

async function handleProjectPage() {
  console.log("Entrou em handleProjectPage");

  var data = await chrome.storage.local.get(["running", "pendingProject"]);
  if (!data.running || !data.pendingProject) return;

  setTimeout(function() {
    var askLink = document.querySelector('a[href*="/project/message/"]');

    if (askLink && askLink.href) {
      window.location.href = askLink.href;
    }
  }, 2000);
}

async function handleMessagePage() {
  console.log("Entrou em handleMessagePage");

  var data = await chrome.storage.local.get([
    "running",
    "pendingProject",
    "apiKey",
    "customPrompt"
  ]);

  if (!data.running || !data.pendingProject || !data.apiKey) return;

  setTimeout(async function() {
    var textarea = document.querySelector("#mensagem-pergunta");
    var submitBtn = document.querySelector("#btnEnviarPergunta");

    if (!textarea || !submitBtn) return;

    var message = await generateMessage(
      data.apiKey,
      data.customPrompt,
      data.pendingProject
    );
    if (!message) {
      await finishAutomation(
        "Automacao interrompida. Nao foi possivel gerar a mensagem."
      );
      return;
    }

    textarea.value = message;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    var returnUrlData = await chrome.storage.local.get("lastListUrl");
    var returnUrl =
      returnUrlData.lastListUrl ||
      "https://www.99freelas.com.br/projects?categoria=web-mobile-e-software";

    var approved = await requestApproval(
      "A mensagem foi revisada e esta pronta para envio?"
    );
    if (!approved) return;

    await chrome.storage.local.set({
      returnAfterSubmit: returnUrl
    });
    await chrome.storage.local.remove("pendingProject");

    submitBtn.click();

    setTimeout(function() {
      window.location.href = returnUrl;
    }, 4000);
  }, 2000);
}

(async function() {
  console.log("Entrou no roteador");

  var url = window.location.href;
  console.log("URL atual:", url);

  if (await maybeReturnToProjectsList()) {
    return;
  }

  if (isProjectsListPage(url)) {
    startAutomation();
    return;
  }

  if (isProjectDetailsPage(url)) {
    handleProjectPage();
    return;
  }

  if (isMessagePage(url)) {
    handleMessagePage();
  }
})();

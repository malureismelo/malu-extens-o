console.log("99frelas content.js carregou");

function wait(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

function extractDays(text) {
  if (!text) return 999;
  text = text.toLowerCase();

  if (text.indexOf("hora") !== -1) return 0;

  var match = text.match(/(\d+)/);
  if (text.indexOf("dia") !== -1 && match) return parseInt(match[1], 10);

  return 999;
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

async function generateMessage(apiKey, project) {
  try {
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
            content:
              "Crie uma mensagem curta, natural e personalizada para este projeto freelance.\n\n" +
              "Título: " + project.title + "\n" +
              "Descrição: " + project.description + "\n\n" +
              "A mensagem deve ser humana, natural, mostrar experiência similar e terminar pedindo conversa."
          }
        ],
        temperature: 0.7
      })
    });

    var data = await res.json();

    if (!res.ok) {
      alert("Erro OpenAI: " + ((data.error && data.error.message) || "Erro desconhecido"));
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
    alert("Erro ao conectar com OpenAI.");
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
  var maxDays = data.maxDays || 2;
  var running = data.running || false;
  var processed = data.processed || [];

  if (!running) return;

  if (!apiKey) {
    alert("Defina sua OpenAI API Key.");
    return;
  }

  var processedSet = new Set(processed);
  var projects = Array.prototype.slice.call(document.querySelectorAll("li.result-item"));

  for (var i = 0; i < projects.length; i++) {
    var state = await chrome.storage.local.get("running");
    if (!state.running) return;

    var project = projects[i];
    var id = project.getAttribute("data-id");

    if (!id || processedSet.has(id)) continue;
    if (isViewed(project)) continue;

    var titleEl = project.querySelector("h1 a");
    var descEl = project.querySelector(".item-text.description");
    var daysEl = project.querySelector(".datetime");

    var title = titleEl ? titleEl.innerText.trim() : "";
    var description = descEl ? descEl.innerText.trim() : "";
    var daysText = daysEl ? daysEl.innerText.trim() : "";

    var skillEls = project.querySelectorAll(".habilidade");
    var skills = "";

    for (var s = 0; s < skillEls.length; s++) {
      skills += skillEls[s].innerText + " ";
    }

    var days = extractDays(daysText);

    if (days > maxDays) {
      await chrome.storage.local.set({ running: false });
      alert("Automação finalizada.");
      return;
    }

    if (isWordPress(skills, description, title)) {
      processedSet.add(id);
      await chrome.storage.local.set({ processed: Array.from(processedSet) });
      continue;
    }

    await chrome.storage.local.set({
      processed: Array.from(processedSet).concat(id),
      pendingProject: {
        id: id,
        title: title,
        description: description
      },
      lastListUrl: window.location.href
    });

    if (titleEl && titleEl.href) {
      window.location.href = titleEl.href;
      return;
    }
  }

  var currentUrl = new URL(window.location.href);
  var currentPage = parseInt(currentUrl.searchParams.get("page") || "1", 10);
  var nextPageNumber = currentPage + 1;

  var nextPageEl = document.querySelector(
    '.page-item[data-page="' + nextPageNumber + '"]'
  );

  if (nextPageEl) {
    window.location.href =
      "https://www.99freelas.com.br/projects?categoria=web-mobile-e-software&page=" +
      nextPageNumber;
    return;
  }

  await chrome.storage.local.set({ running: false });
  alert("Automação finalizada. Não há mais páginas.");
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
    "apiKey"
  ]);

  if (!data.running || !data.pendingProject || !data.apiKey) return;

  setTimeout(async function() {
    var textarea = document.querySelector("#mensagem-pergunta");
    var submitBtn = document.querySelector("#btnEnviarPergunta");

    if (!textarea || !submitBtn) return;

    var message = await generateMessage(data.apiKey, data.pendingProject);
    if (!message) return;

    textarea.value = message;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    var returnUrlData = await chrome.storage.local.get("lastListUrl");
    var returnUrl =
      returnUrlData.lastListUrl ||
      "https://www.99freelas.com.br/projects?categoria=web-mobile-e-software";

    await chrome.storage.local.remove("pendingProject");

    var approved = confirm("A mensagem foi revisada e está pronta para envio?");
    if (!approved) return;

    submitBtn.click();

    setTimeout(function() {
      window.location.href = returnUrl;
    }, 4000);
  }, 2000);
}

(function() {
  console.log("Entrou no roteador");

  var url = window.location.href;
  console.log("URL atual:", url);

  if (url.indexOf("/projects?") !== -1) {
    startAutomation();
    return;
  }

  if (
    url.indexOf("/project/") !== -1 &&
    url.indexOf("/project/message/") === -1
  ) {
    handleProjectPage();
    return;
  }

  if (url.indexOf("/project/message/") !== -1) {
    handleMessagePage();
  }
})();
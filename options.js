const defaultPrompt =
  "Crie uma mensagem curta, natural e personalizada para este projeto freelance. " +
  "A mensagem deve ser humana, natural, mostrar experiencia similar e terminar pedindo conversa.";

const apiKeyEl = document.getElementById("apiKey");
const customPromptEl = document.getElementById("customPrompt");
const statusEl = document.getElementById("status");

chrome.storage.local.get(["apiKey", "customPrompt"], (res) => {
  if (res.apiKey) apiKeyEl.value = res.apiKey;
  customPromptEl.value = res.customPrompt || defaultPrompt;
});

document.getElementById("save").onclick = () => {
  const key = apiKeyEl.value.trim();
  const customPrompt = customPromptEl.value.trim() || defaultPrompt;

  chrome.storage.local.set({
    apiKey: key,
    customPrompt: customPrompt
  }, () => {
    statusEl.textContent = "Salvo com sucesso.";
    setTimeout(() => {
      statusEl.textContent = "";
    }, 2500);
  });
};

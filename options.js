document.getElementById("save").onclick = () => {
  const key = document.getElementById("apiKey").value;

  chrome.storage.local.set({
    apiKey: key
  });

  alert("Salvo!");
};
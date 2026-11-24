// background.js - Abre o dashboard como uma aba dedicada
chrome.action.onClicked.addListener(async () => {
  const urlDashboard = chrome.runtime.getURL("dashboard.html");
  
  const abas = await chrome.tabs.query({ url: urlDashboard });
  if (abas.length > 0) {
    chrome.tabs.update(abas[0].id, { active: true });
  } else {
    chrome.tabs.create({ url: urlDashboard });
  }
});
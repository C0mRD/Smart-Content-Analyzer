// background.js
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: () => {
      if (window.extractor) {
        window.extractor.init();
      }
    },
  });
});

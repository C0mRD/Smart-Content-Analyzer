chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "elementSelected") {
    // Store or process selected elements
    chrome.storage.local.get(["selectedElements"], (result) => {
      const selectedElements = result.selectedElements || [];
      selectedElements.push({
        selector: message.selector,
        text: message.text,
      });

      chrome.storage.local.set({
        selectedElements: selectedElements,
      });
    });
  }
});

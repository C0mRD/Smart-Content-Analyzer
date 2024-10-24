let selectedElements = [];
let highlightedElement = null;
let isActive = true; // Active by default

function handleMouseMove(event) {
  if (!isActive) return;

  if (highlightedElement) {
    highlightedElement.style.outline = "";
  }

  highlightedElement = event.target;
  highlightedElement.style.outline = "2px solid green";
}

function handleClick(event) {
  if (!isActive) return;

  event.preventDefault();
  let elementText = event.target.textContent.trim();
  let elementTitle = prompt(
    "Enter a title for this selection:",
    elementText.substring(0, 30) + "...",
  );

  if (elementTitle) {
    selectedElements.push({
      title: elementTitle,
      content: elementText,
    });

    console.log("Sending data:", selectedElements);
    chrome.runtime.sendMessage(
      { action: "updateData", data: selectedElements },
      (response) => {
        console.log("Response from background:", response);
      },
    );
  }
}

document.addEventListener("mousemove", handleMouseMove);
document.addEventListener("click", handleClick);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in content script:", message);
  if (message.action === "getSelectedElements") {
    console.log("Sending selected elements:", selectedElements);
    sendResponse(selectedElements);
  } else if (message.action === "toggleState") {
    isActive = message.isActive;
    if (!isActive && highlightedElement) {
      highlightedElement.style.outline = "";
      highlightedElement = null;
    }
  }
});

// Initialize state
chrome.storage.local.get("isActive", function (result) {
  isActive = result.isActive !== undefined ? result.isActive : true;
});

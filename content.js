let selectedElements = [];
let highlightedElement = null;
let isActive = true; // Active by default

function handleMouseMove(event) {
  if (!isActive) return; // Do nothing if Inactive

  // Remove previous highlight if there was one
  if (highlightedElement) {
    highlightedElement.style.outline = "";
  }

  // Highlight the current element
  highlightedElement = event.target;
  highlightedElement.style.outline = "2px solid green";
}

function handleClick(event) {
  if (!isActive) {
    event.preventDefault(); // Prevent any default action if Inactive
    return;
  }

  // Check if the clicked element is an anchor (a hyperlink)
  if (event.target.tagName.toLowerCase() === "a") {
    event.preventDefault(); // Prevent hyperlink navigation
  }

  // Collect the text content of the clicked element
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

    // Send the updated selected elements to the background
    chrome.runtime.sendMessage(
      { action: "updateData", data: selectedElements },
      (response) => {
        console.log("Response from background:", response);
      },
    );
  }
}

// Add event listeners for mousemove and click
document.addEventListener("mousemove", handleMouseMove);
document.addEventListener("click", handleClick);

// Handle messages from the popup (Active/Inactive toggle)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleState") {
    isActive = message.isActive; // Update the active state
    if (!isActive && highlightedElement) {
      highlightedElement.style.outline = ""; // Remove highlight when inactive
      highlightedElement = null;
    }
  }
  sendResponse({ status: "State updated" });
});

// Initialize the active state when the content script runs
chrome.storage.local.get("isActive", function (result) {
  isActive = result.isActive !== undefined ? result.isActive : true;
});

let selectedElements = [];
let highlightedElement = null;
let isActive = true;
let isSelectingAttribute = false;

// Add selection overlay
const overlay = document.createElement("div");
overlay.style.cssText = `
  position: fixed;
  pointer-events: none;
  border: 2px solid #4CAF50;
  background: rgba(76, 175, 80, 0.1);
  z-index: 10000;
  display: none;
`;
document.body.appendChild(overlay);

function updateOverlay(element) {
  if (!element) {
    overlay.style.display = "none";
    return;
  }

  const rect = element.getBoundingClientRect();
  overlay.style.display = "block";
  overlay.style.top = rect.top + window.scrollY + "px";
  overlay.style.left = rect.left + window.scrollX + "px";
  overlay.style.width = rect.width + "px";
  overlay.style.height = rect.height + "px";
}

function handleMouseMove(event) {
  if (!isActive || !isSelectingAttribute) return;

  if (highlightedElement !== event.target) {
    highlightedElement = event.target;
    updateOverlay(highlightedElement);
  }
}

function handleClick(event) {
  if (!isActive || !isSelectingAttribute) return;

  event.preventDefault();
  event.stopPropagation();

  const selector = getUniqueSelector(event.target);
  chrome.runtime.sendMessage({
    action: "elementSelected",
    selector: selector,
    text: event.target.textContent.trim(),
  });

  // Store selection state in storage
  chrome.storage.local.set({
    lastSelection: {
      selector: selector,
      text: event.target.textContent.trim(),
    },
  });

  isSelectingAttribute = false;
  updateOverlay(null);
}

function getUniqueSelector(element) {
  const path = [];
  while (element && element.nodeType === Node.ELEMENT_NODE) {
    let selector = element.tagName.toLowerCase();

    if (element.id) {
      selector = "#" + element.id;
      path.unshift(selector);
      break;
    }

    if (element.className) {
      const classes = Array.from(element.classList)
        .filter((c) => !c.startsWith("_")) // Filter out dynamic classes
        .join(".");
      if (classes) {
        selector += "." + classes;
      }
    }

    let sibling = element;
    let nth = 1;
    while ((sibling = sibling.previousElementSibling)) {
      if (sibling.tagName === element.tagName) nth++;
    }

    if (nth > 1) selector += `:nth-of-type(${nth})`;

    path.unshift(selector);
    element = element.parentElement;
  }

  return path.join(" > ");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleState") {
    isActive = message.isActive;
    if (!isActive) {
      isSelectingAttribute = false;
      updateOverlay(null);
    }
  } else if (message.action === "startSelection") {
    isSelectingAttribute = true;
    // Store selection state
    chrome.storage.local.set({ isSelectingAttribute: true });
  } else if (message.action === "stopSelection") {
    isSelectingAttribute = false;
    updateOverlay(null);
    // Clear selection state
    chrome.storage.local.remove(["isSelectingAttribute", "lastSelection"]);
  }
  sendResponse({ status: "received" });
  return true;
});

// Restore selection state on page load
chrome.storage.local.get(["isSelectingAttribute"], function (result) {
  isSelectingAttribute = result.isSelectingAttribute || false;
});

document.addEventListener("mousemove", handleMouseMove);
document.addEventListener("click", handleClick);

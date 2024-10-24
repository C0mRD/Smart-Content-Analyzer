document.addEventListener("DOMContentLoaded", function () {
  const toggleButton = document.getElementById("toggleButton");
  const toggleStatus = document.getElementById("toggleStatus");

  // Check the initial state
  chrome.storage.local.get("isActive", function (result) {
    const isActive = result.isActive !== undefined ? result.isActive : true;
    toggleButton.checked = isActive;
    updateToggleStatus(isActive);
    // Ensure storage is set if it wasn't already
    chrome.storage.local.set({ isActive: isActive });
  });

  // Handle toggle button change
  toggleButton.addEventListener("change", function () {
    const isActive = toggleButton.checked;
    chrome.storage.local.set({ isActive: isActive }, function () {
      updateToggleStatus(isActive);
      // Send message to content script to update its state
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggleState",
          isActive: isActive,
        });
      });
    });
  });

  function updateToggleStatus(isActive) {
    toggleStatus.textContent = isActive ? "Active" : "Inactive";
  }

  // Fetch and display selected elements
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "getSelectedElements" },
      function (response) {
        console.log("Received selected elements in popup:", response);
        let selectedItemsDiv = document.getElementById("selected-items");
        selectedItemsDiv.innerHTML = ""; // Clear previous content
        if (response && response.length > 0) {
          response.forEach((item, index) => {
            let itemDiv = document.createElement("div");
            itemDiv.className = "item";
            itemDiv.innerHTML = `
            <strong>${index + 1}. ${item.title}</strong><br>
            ${item.content.substring(0, 50)}...
          `;
            selectedItemsDiv.appendChild(itemDiv);
          });
        } else {
          selectedItemsDiv.textContent = "No items selected yet.";
        }
      },
    );
  });

  // Set up download buttons
  document.getElementById("save-excel").addEventListener("click", () => {
    console.log("Initiating Excel download");
    chrome.runtime.sendMessage({ action: "downloadData", fileType: "excel" });
  });

  document.getElementById("save-word").addEventListener("click", () => {
    console.log("Initiating Word download");
    chrome.runtime.sendMessage({ action: "downloadData", fileType: "word" });
  });
});

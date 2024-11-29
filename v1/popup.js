// popup.js
document.addEventListener("DOMContentLoaded", function () {
  // Get DOM elements
  const toggleButton = document.getElementById("toggleButton");
  const toggleStatus = document.getElementById("toggleStatus");
  const recipeListDiv = document.getElementById("recipes");
  const dataTable = document.getElementById("data-table");
  const saveExcelButton = document.getElementById("save-excel");
  const addRecipeButton = document.getElementById("add-recipe-button");
  const selectionModeDiv = document.getElementById("selection-mode");

  // State variables
  let recipes = [];
  let currentRecipeIndex = null;

  // Function definitions
  function updateToggleStatus(isActive) {
    if (toggleStatus) {
      toggleStatus.textContent = isActive ? "Active" : "Inactive";
    }
  }

  function renderRecipes() {
    recipeListDiv.innerHTML = "";
    recipes.forEach((recipe, recipeIndex) => {
      const recipeDiv = document.createElement("div");
      recipeDiv.className = "recipe";

      const recipeTitle = document.createElement("h3");
      recipeTitle.textContent = recipe.name;
      recipeDiv.appendChild(recipeTitle);

      const addAttrButton = document.createElement("button");
      addAttrButton.textContent = "Add Attribute";
      addAttrButton.addEventListener("click", () =>
        startAttributeSelection(recipeIndex),
      );
      recipeDiv.appendChild(addAttrButton);

      recipe.attributes.forEach((attr, attrIndex) => {
        const attrDiv = document.createElement("div");
        attrDiv.className = "attribute";

        const attrText = document.createElement("span");
        attrText.textContent = attr.name;
        attrDiv.appendChild(attrText);

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () =>
          deleteAttribute(recipeIndex, attrIndex),
        );
        attrDiv.appendChild(deleteButton);

        recipeDiv.appendChild(attrDiv);
      });

      recipeListDiv.appendChild(recipeDiv);
    });
  }

  function startAttributeSelection(recipeIndex) {
    currentRecipeIndex = recipeIndex;
    selectionModeDiv.classList.add("active");
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs
          .sendMessage(tabs[0].id, { action: "startSelection" })
          .catch((error) => {
            console.error("Error sending message to content script:", error);
          });
      }
    });
    // Store selection state
    chrome.storage.local.set({
      isSelectingAttribute: true,
      currentRecipeIndex: recipeIndex,
    });
  }

  function deleteAttribute(recipeIndex, attrIndex) {
    if (recipes[recipeIndex] && recipes[recipeIndex].attributes) {
      recipes[recipeIndex].attributes.splice(attrIndex, 1);
      renderRecipes();
      extractDataForPreview(recipeIndex);
      // Save updated recipes
      chrome.storage.local.set({ recipes: recipes });
    }
  }

  async function extractDataForPreview(recipeIndex) {
    if (!recipes[recipeIndex]) return;

    const recipe = recipes[recipeIndex];

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) return;

      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (selectors) => {
          return selectors.map((selector) => {
            try {
              const elements = document.querySelectorAll(selector);
              return Array.from(elements).map((el) => el.textContent.trim());
            } catch (error) {
              console.error(
                `Error selecting elements with selector ${selector}:`,
                error,
              );
              return [];
            }
          });
        },
        args: [recipe.attributes.map((attr) => attr.selector)],
      });

      if (!result || !result[0] || !result[0].result) return;

      const extractedData = result[0].result;
      const tableData = [];
      const headers = recipe.attributes.map((attr) => attr.name);
      tableData.push(headers);

      const maxRows = Math.max(...extractedData.map((col) => col.length));
      for (let i = 0; i < Math.min(maxRows, 3); i++) {
        const row = extractedData.map((col) => col[i] || "");
        tableData.push(row);
      }

      updateDataPreview(tableData);
    } catch (error) {
      console.error("Error extracting data:", error);
    }
  }

  function updateDataPreview(tableData) {
    if (!dataTable) return;

    dataTable.innerHTML = "";
    tableData.forEach((row, index) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => {
        const td = document.createElement(index === 0 ? "th" : "td");
        td.textContent = cell || "";
        tr.appendChild(td);
      });
      dataTable.appendChild(tr);
    });
  }

  function processElementSelection(selection) {
    if (currentRecipeIndex === null) return;

    const attrName = prompt(
      "Enter attribute name for selected element:",
      selection.text ? selection.text.substring(0, 30) : "",
    );

    if (attrName) {
      if (!recipes[currentRecipeIndex].attributes) {
        recipes[currentRecipeIndex].attributes = [];
      }

      recipes[currentRecipeIndex].attributes.push({
        name: attrName,
        selector: selection.selector,
      });

      renderRecipes();
      extractDataForPreview(currentRecipeIndex);

      // Clear selection state
      chrome.storage.local.remove(["isSelectingAttribute", "lastSelection"]);
      selectionModeDiv.classList.remove("active");

      // Stop selection mode in content script
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          chrome.tabs
            .sendMessage(tabs[0].id, { action: "stopSelection" })
            .catch((error) => {
              console.error("Error sending stop selection message:", error);
            });
        }
      });

      // Save updated recipes
      chrome.storage.local.set({
        recipes: recipes,
        currentRecipeIndex: null,
      });

      currentRecipeIndex = null;
    }
  }

  // Initialize state
  chrome.storage.local.get(
    [
      "isActive",
      "recipes",
      "isSelectingAttribute",
      "lastSelection",
      "currentRecipeIndex",
    ],
    function (result) {
      const isActive = result.isActive !== undefined ? result.isActive : true;
      toggleButton.checked = isActive;
      updateToggleStatus(isActive);

      if (result.recipes) {
        recipes = result.recipes;
        renderRecipes();
      }

      if (result.currentRecipeIndex !== undefined) {
        currentRecipeIndex = result.currentRecipeIndex;
      }

      if (result.isSelectingAttribute) {
        selectionModeDiv.classList.add("active");
        if (result.lastSelection) {
          processElementSelection(result.lastSelection);
        }
      }
    },
  );

  // Event Listeners
  toggleButton.addEventListener("change", function () {
    const isActive = toggleButton.checked;
    chrome.storage.local.set({ isActive: isActive }, function () {
      updateToggleStatus(isActive);
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          chrome.tabs
            .sendMessage(tabs[0].id, {
              action: "toggleState",
              isActive: isActive,
            })
            .catch((error) => {
              console.error("Error sending toggle state:", error);
            });
        }
      });
    });
  });

  addRecipeButton.addEventListener("click", function () {
    const recipeName = prompt("Enter recipe name:");
    if (recipeName) {
      const recipe = { name: recipeName, attributes: [] };
      recipes.push(recipe);
      renderRecipes();
      // Save updated recipes
      chrome.storage.local.set({ recipes: recipes });
    }
  });

  saveExcelButton.addEventListener("click", function () {
    chrome.runtime.sendMessage({
      action: "downloadData",
      recipes: recipes,
    });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "elementSelected") {
      processElementSelection(message);
    }
    return true;
  });

  // Save state before popup closes
  window.addEventListener("beforeunload", function () {
    chrome.storage.local.set({
      recipes: recipes,
      currentRecipeIndex: currentRecipeIndex,
    });
  });
});

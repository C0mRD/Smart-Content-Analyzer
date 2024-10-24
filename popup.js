document.addEventListener("DOMContentLoaded", function () {
  const toggleButton = document.getElementById("toggleButton");
  const toggleStatus = document.getElementById("toggleStatus");
  const recipeListDiv = document.getElementById("recipes");
  const dataTable = document.getElementById("data-table");
  const saveExcelButton = document.getElementById("save-excel");
  let recipes = [];

  // Initialize toggle button state
  chrome.storage.local.get("isActive", function (result) {
    const isActive = result.isActive !== undefined ? result.isActive : true;
    toggleButton.checked = isActive;
    updateToggleStatus(isActive);
  });

  toggleButton.addEventListener("change", function () {
    const isActive = toggleButton.checked;
    chrome.storage.local.set({ isActive: isActive }, function () {
      updateToggleStatus(isActive);
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

  // Add a new recipe
  document
    .getElementById("add-recipe-button")
    .addEventListener("click", function () {
      const recipeName = prompt("Enter recipe name:");
      if (recipeName) {
        const recipe = { name: recipeName, attributes: [] };
        recipes.push(recipe);
        renderRecipes();
      }
    });

  function renderRecipes() {
    recipeListDiv.innerHTML = "";
    recipes.forEach((recipe, recipeIndex) => {
      const recipeDiv = document.createElement("div");
      recipeDiv.className = "recipe";
      recipeDiv.innerHTML = `<h3>${recipe.name}</h3>
                <button onclick="addAttribute(${recipeIndex})">Add Attribute</button>`;
      recipe.attributes.forEach((attr, attrIndex) => {
        const attrDiv = document.createElement("div");
        attrDiv.className = "attribute";
        attrDiv.innerHTML = `${attr.name} <button onclick="deleteAttribute(${recipeIndex}, ${attrIndex})">Delete</button>`;
        recipeDiv.appendChild(attrDiv);
      });
      recipeListDiv.appendChild(recipeDiv);
    });
  }

  // Function to add attributes to a recipe
  window.addAttribute = function (recipeIndex) {
    const attrName = prompt("Enter attribute name:");
    if (attrName) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "getSelector" },
          function (selector) {
            recipes[recipeIndex].attributes.push({
              name: attrName,
              selector: selector,
            });
            renderRecipes();
            extractDataForPreview(recipeIndex); // Extract data when a new attribute is added
          },
        );
      });
    }
  };

  // Function to delete attributes
  window.deleteAttribute = function (recipeIndex, attrIndex) {
    recipes[recipeIndex].attributes.splice(attrIndex, 1);
    renderRecipes();
    extractDataForPreview(recipeIndex); // Update preview after deletion
  };

  // Function to extract data for preview
  function extractDataForPreview(recipeIndex) {
    const recipe = recipes[recipeIndex];
    const tableData = [];

    // Prepare the header
    const headers = recipe.attributes.map((attr) => attr.name);
    tableData.push(headers);

    // Extract data based on selectors
    const rows = [];
    const selectors = recipe.attributes.map((attr) => attr.selector);
    const elements = selectors.map((selector) =>
      document.querySelectorAll(selector),
    );

    // Extract data from each selector
    const maxRows = Math.max(...elements.map((el) => el.length)); // Get max length of elements

    for (let i = 0; i < maxRows; i++) {
      const row = [];
      selectors.forEach((selector, index) => {
        const text = elements[index][i] ? elements[index][i].innerText : "";
        row.push(text);
      });
      rows.push(row);
    }

    tableData.push(...rows.slice(0, 3)); // Only preview first 3 rows
    updateDataPreview(tableData);
  }

  // Function to update the data preview table
  function updateDataPreview(tableData) {
    dataTable.innerHTML = ""; // Clear existing table

    tableData.forEach((row, index) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => {
        const td = document.createElement(index === 0 ? "th" : "td");
        td.innerText = cell;
        tr.appendChild(td);
      });
      dataTable.appendChild(tr);
    });
  }

  saveExcelButton.addEventListener("click", function () {
    chrome.runtime.sendMessage({ action: "downloadData", recipes: recipes });
  });

  // Load saved recipes if any
  chrome.storage.local.get("recipes", function (data) {
    if (data.recipes) {
      recipes = data.recipes;
      renderRecipes();
    }
  });

  // Save recipes on unload
  window.addEventListener("beforeunload", function () {
    chrome.storage.local.set({ recipes: recipes });
  });
});

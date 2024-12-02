// v2 content.js
(function () {
  if (window.hasRun) return;
  window.hasRun = true;

  class ListingExtractor {
    constructor() {
      this.sidebar = null;
      this.currentData = null;
      this.extractedListings = [];
      this.isLoading = false;
      this.isSelectingMode = false;
      this.selectedElements = new Map(); // Store selected elements and their labels
    }

    createFloatingButton() {
      const button = document.createElement("div");
      button.id = "extractor-floating-button";
      button.innerHTML = `
        <div class="floating-button">
          <span>📊</span>
        </div>
        <style>
          #extractor-floating-button {
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 9999;
            cursor: pointer;
          }
          .floating-button {
            width: 50px;
            height: 50px;
            background: #4CAF50;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: transform 0.2s;
          }
          .floating-button:hover {
            transform: scale(1.1);
          }
        </style>
      `;

      document.body.appendChild(button);
      button.onclick = () => this.init();
    }

    init() {
      if (!document.getElementById("extractor-sidebar")) {
        this.createSidebar();
        this.extractListings();
      }
    }

    createSidebar() {
      this.sidebar = document.createElement("div");
      this.sidebar.id = "extractor-sidebar";
      this.sidebar.innerHTML = `
        <div class="sidebar-header">
          <h2>Content Extractor</h2>
          <button id="close-sidebar">×</button>
        </div>
        <div class="mode-selector">
          <button id="auto-mode" class="mode-btn active">Auto Extract</button>
          <button id="manual-mode" class="mode-btn">Manual Select</button>
        </div>
        <div class="manual-controls" style="display: none;">
          <div class="manual-buttons">
            <button id="start-selection" class="action-btn">Select Element</button>
            <button id="download-manual" class="action-btn">Download Excel</button>
          </div>
          <div style="color: #666; font-size: 12px; margin: 8px 0;">
            Showing first 5 rows (all rows will be included in download)
          </div>
          <div id="selected-elements"></div>
        </div>
        <div class="auto-controls">
          <button id="refresh-data" class="action-btn">Refresh Data</button>
          <button id="download-auto" class="action-btn">Download Excel</button>
        </div>
        <div id="extraction-content"></div>
        <style>
          #extractor-sidebar {
            position: fixed;
            top: 0;
            right: 0;
            width: 400px;
            height: 100vh;
            background: white;
            box-shadow: -2px 0 5px rgba(0,0,0,0.2);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            font-family: Arial, sans-serif;
            overflow-y: auto;
          }
          .sidebar-header {
            padding: 15px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .controls {
            padding: 15px;
            border-bottom: 1px solid #eee;
            display: flex;
            gap: 10px;
          }
          #extraction-content {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
          }
          .action-btn {
            padding: 8px 15px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          .action-btn:hover {
            background: #45a049;
          }
          .action-btn:disabled {
            background: #cccccc;
            cursor: not-allowed;
          }
          .listing-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          .listing-table th, .listing-table td {
            border: 1px solid #ddd;
            padding: 8px;
            font-size: 12px;
          }
          .listing-table th {
            background: #f5f5f5;
            position: sticky;
            top: 0;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .loading {
            text-align: center;
            padding: 20px;
          }
          .error {
            color: red;
            padding: 20px;
            text-align: center;
          }
          .mode-selector {
            display: flex;
            padding: 10px;
            gap: 10px;
            border-bottom: 1px solid #eee;
          }
          
          .mode-btn {
            flex: 1;
            padding: 8px;
            border: 1px solid #4CAF50;
            background: white;
            color: #4CAF50;
            border-radius: 4px;
            cursor: pointer;
          }
          
          .mode-btn.active {
            background: #4CAF50;
            color: white;
          }
          
          .selection-fields {
            display: flex;
            gap: 10px;
            padding: 10px;
          }
          
          #field-selector {
            flex: 1;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          
          .selected-element {
            margin: 10px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .element-highlight {
            position: fixed;
            pointer-events: none;
            border: 2px solid #4CAF50;
            background: rgba(76, 175, 80, 0.1);
            z-index: 10000;
            transition: all 0.1s ease;
          }
          .manual-controls {
            padding: 15px;
            border-bottom: 1px solid #eee;
          }
          #selected-elements {
            margin-top: 10px;
          }
          .selected-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          .selected-table th, .selected-table td {
            border: 1px solid #ddd;
            padding: 8px;
            font-size: 12px;
            text-align: left;
          }
          .selected-table th {
            background: #f5f5f5;
          }
          .manual-buttons {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
          }
        </style>
      `;

      document.body.appendChild(this.sidebar);
      this.setupEventListeners();
    }

    setupEventListeners() {
      this.sidebar.querySelector("#close-sidebar").onclick = () => {
        this.sidebar.remove();
      };

      const autoMode = this.sidebar.querySelector("#auto-mode");
      const manualMode = this.sidebar.querySelector("#manual-mode");
      const manualControls = this.sidebar.querySelector(".manual-controls");
      const autoControls = this.sidebar.querySelector(".auto-controls");

      autoMode.onclick = () => {
        autoMode.classList.add("active");
        manualMode.classList.remove("active");
        manualControls.style.display = "none";
        autoControls.style.display = "block";
        this.stopSelectionMode();
      };

      manualMode.onclick = () => {
        manualMode.classList.add("active");
        autoMode.classList.remove("active");
        manualControls.style.display = "block";
        autoControls.style.display = "none";
      };

      const startSelectionBtn = this.sidebar.querySelector("#start-selection");
      startSelectionBtn.addEventListener("click", () => {
        this.startSelectionMode();
      });

      // Prevent link clicks during selection mode
      document.addEventListener("click", (e) => {
        if (this.isSelectingMode) {
          e.preventDefault();
          if (e.target.tagName === "A") {
            this.handleElementSelection(e.target);
          }
        }
      }, true);

      const refreshButton = this.sidebar.querySelector("#refresh-data");
      refreshButton.onclick = () => {
        if (!this.isLoading) {
          this.extractListings();
        }
      };

      const downloadManualBtn = this.sidebar.querySelector("#download-manual");
      downloadManualBtn.onclick = () => this.downloadManualSelected();

      const downloadAutoBtn = this.sidebar.querySelector("#download-auto");
      downloadAutoBtn.onclick = () => this.downloadAutoSelected();
    }

    showLoading() {
      this.isLoading = true;
      const container = document.getElementById("extraction-content");
      const refreshButton = this.sidebar.querySelector("#refresh-data");
      refreshButton.disabled = true;

      container.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <p>Extracting listings...</p>
        </div>
      `;
    }

    async extractListings() {
      try {
        this.showLoading();

        const pageData = {
          url: window.location.href,
          title: document.title,
          html: document.documentElement.outerHTML,
          hostname: window.location.hostname,
        };

        const response = await fetch("http://localhost:8000/extract-listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pageData),
        });

        if (!response.ok) throw new Error("Extraction failed");

        const result = await response.json();
        this.extractedListings = result.listings;
        this.displayResults();
      } catch (error) {
        this.showError(error.message);
      } finally {
        this.isLoading = false;
        const refreshButton = this.sidebar.querySelector("#refresh-data");
        refreshButton.disabled = false;
      }
    }

    displayResults() {
      if (!this.extractedListings?.length) {
        this.showError("No listings found");
        return;
      }

      const container = document.getElementById("extraction-content");
      const columns = Object.keys(this.extractedListings[0]);

      let html = `
        <table class="listing-table">
          <thead>
            <tr>
              ${columns.map((col) => `<th>${col}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${this.extractedListings
              .map(
                (listing) => `
                <tr>
                  ${columns.map((col) => `<td>${listing[col] || ""}</td>`).join("")}
                </tr>
              `,
              )
              .join("")}
          </tbody>
        </table>
      `;

      container.innerHTML = html;
    }

    showError(message) {
      const container = document.getElementById("extraction-content");
      container.innerHTML = `<div class="error">${message}</div>`;
    }

    downloadManualSelected() {
      if (!this.selectedElements?.size) return;

      const headers = Array.from(this.selectedElements.keys());
      const rows = [headers.join(",")];

      const maxRows = this.getMaxRows();
      for (let i = 0; i < maxRows; i++) {
        const row = [];
        for (const [_, data] of this.selectedElements) {
          let value = data.values[i] || "";
          value = value.toString().replace(/"/g, '""');
          row.push(`"${value}"`);
        }
        rows.push(row.join(","));
      }

      const csv = rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "manual-selected-data.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    downloadAutoSelected() {
      if (!this.extractedListings?.length) return;

      const columns = Object.keys(this.extractedListings[0]);
      const rows = [columns.join(",")];

      this.extractedListings.forEach((listing) => {
        const row = columns.map((col) => {
          let value = listing[col] || "";
          value = value.toString().replace(/"/g, '""');
          return `"${value}"`;
        });
        rows.push(row.join(","));
      });

      const csv = rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "auto-extracted-data.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    startSelectionMode() {
      this.isSelectingMode = true;
      document.body.style.cursor = "crosshair";
      
      document.addEventListener("mousemove", this.handleMouseMove);
      document.addEventListener("click", this.handleClick, true);
    }
    stopSelectionMode() {
      this.isSelectingMode = false;
      document.body.style.cursor = "default";
      
      document.removeEventListener("mousemove", this.handleMouseMove);
      document.removeEventListener("click", this.handleClick, true);
      
      const highlight = document.querySelector(".element-highlight");
      if (highlight) highlight.remove();
    }

    handleMouseMove = (e) => {
      if (!this.isSelectingMode) return;

      const target = e.target;
      if (!target || target === this.sidebar) {
        const highlight = document.querySelector(".element-highlight");
        if (highlight) highlight.style.display = "none";
        return;
      }

      let highlight = document.querySelector(".element-highlight");
      if (!highlight) {
        highlight = document.createElement("div");
        highlight.className = "element-highlight";
        document.body.appendChild(highlight);
      }

      const rect = target.getBoundingClientRect();
      highlight.style.display = "block";
      highlight.style.top = rect.top + window.scrollY + "px";
      highlight.style.left = rect.left + window.scrollX + "px";
      highlight.style.width = rect.width + "px";
      highlight.style.height = rect.height + "px";
    };

    handleClick = (e) => {
      if (!this.isSelectingMode) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.target;
      if (target === this.sidebar || target.closest("#extractor-sidebar")) return;

      const attributeName = prompt("Enter name for this column:", "");
      if (!attributeName) return;

      const selector = this.getUniqueSelector(target);
      const allElements = document.querySelectorAll(selector);
      const values = Array.from(allElements).map(el => el.textContent.trim());

      this.addSelectedColumn(attributeName, selector, values);
      this.stopSelectionMode();
    };

    addSelectedColumn(attributeName, selector, values) {
      if (!this.selectedElements) {
        this.selectedElements = new Map();
      }

      this.selectedElements.set(attributeName, {
        selector: selector,
        values: values
      });

      this.updateSelectedTable();
    }

    updateSelectedTable() {
      const container = this.sidebar.querySelector("#selected-elements");
      if (!container) return;

      // Create table with preview notice
      let html = `
        <table class="selected-table">
            <thead>
                <tr>
                    ${Array.from(this.selectedElements.keys())
                        .map(key => `<th>${key}</th>`)
                        .join("")}
                </tr>
            </thead>
            <tbody>
      `;

      // Show only first 5 rows in preview
      const PREVIEW_ROWS = 5;
      for (let i = 0; i < PREVIEW_ROWS; i++) {
        html += "<tr>";
        for (const [_, data] of this.selectedElements) {
          html += `<td>${data.values[i] || ""}</td>`;
        }
        html += "</tr>";
      }

      html += `
            </tbody>
        </table>
      `;

      container.innerHTML = html;
    }

    // Helper method to get total number of rows
    getMaxRows() {
      return Math.max(...Array.from(this.selectedElements.values())
        .map(data => data.values.length));
    }

    downloadSelected() {
      if (!this.selectedElements?.size) return;

      const headers = Array.from(this.selectedElements.keys());
      const rows = [headers.join(",")];

      const maxRows = Math.max(...Array.from(this.selectedElements.values())
        .map(data => data.values.length));

      for (let i = 0; i < maxRows; i++) {
        const row = [];
        for (const [_, data] of this.selectedElements) {
          let value = data.values[i] || "";
          value = value.toString().replace(/"/g, '""');
          row.push(`"${value}"`);
        }
        rows.push(row.join(","));
      }

      const csv = rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "selected-data.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    getUniqueSelector(element) {
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
  }

  // Create extractor instance but don't initialize automatically
  window.extractor = new ListingExtractor();

  // Add floating button if needed
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("floatingButton") === "true") {
    window.extractor.createFloatingButton();
  }
})();


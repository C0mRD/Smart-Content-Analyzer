// content.js
(function () {
  if (window.hasRun) return;
  window.hasRun = true;

  class ListingExtractor {
    constructor() {
      this.sidebar = null;
      this.currentData = null;
      this.extractedListings = [];
      this.isLoading = false;
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
          <h2>Listing Extractor</h2>
          <button id="close-sidebar">×</button>
        </div>
        <div class="controls">
          <button id="refresh-data" class="action-btn">Refresh Data</button>
          <button id="download-excel" class="action-btn">Download Excel</button>
        </div>
        <div id="extraction-content">
          <div class="loading">
            <div class="spinner"></div>
            <p>Extracting listings...</p>
          </div>
        </div>
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
        </style>
      `;

      document.body.appendChild(this.sidebar);
      this.setupEventListeners();
    }

    setupEventListeners() {
      this.sidebar.querySelector("#close-sidebar").onclick = () => {
        this.sidebar.remove();
      };

      const refreshButton = this.sidebar.querySelector("#refresh-data");
      refreshButton.onclick = () => {
        if (!this.isLoading) {
          this.extractListings();
        }
      };

      this.sidebar.querySelector("#download-excel").onclick = () => {
        this.downloadExcel();
      };
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

    downloadExcel() {
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
      a.download = "extracted-listings.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

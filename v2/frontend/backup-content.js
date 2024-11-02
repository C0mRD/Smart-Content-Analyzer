// content.js
(function () {
  if (window.hasRun) return;
  window.hasRun = true;

  class ListingExtractor {
    constructor() {
      this.sidebar = null;
      this.currentData = null;
      this.extractedListings = [];
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
                </style>
            `;

      document.body.appendChild(this.sidebar);
      this.setupEventListeners();
    }

    setupEventListeners() {
      this.sidebar.querySelector("#close-sidebar").onclick = () =>
        this.sidebar.remove();
      this.sidebar.querySelector("#refresh-data").onclick = () =>
        this.extractListings();
      this.sidebar.querySelector("#download-excel").onclick = () =>
        this.downloadExcel();
    }

    async extractListings() {
      try {
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
          // Escape quotes and commas for CSV
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

  window.extractor = new ListingExtractor();
  window.extractor.init();
})();

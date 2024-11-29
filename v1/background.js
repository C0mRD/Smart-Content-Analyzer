chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "downloadData") {
    const recipes = message.recipes;

    // Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Extract data for each recipe
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selectors) => {
        return selectors.map((selector) => {
          const elements = document.querySelectorAll(selector);
          return Array.from(elements).map((el) => el.textContent.trim());
        });
      },
      args: [
        recipes
          .map((recipe) => recipe.attributes.map((attr) => attr.selector))
          .flat(),
      ],
    });

    const extractedData = results[0].result;

    // Format data for CSV
    let csvContent = "data:text/csv;charset=utf-8,";

    // Add headers
    const headers = recipes
      .map((recipe) => recipe.attributes.map((attr) => attr.name))
      .flat();
    csvContent += headers.join(",") + "\n";

    // Add data rows
    const maxRows = Math.max(...extractedData.map((col) => col.length));
    for (let i = 0; i < maxRows; i++) {
      const row = extractedData.map((col) => col[i] || "");
      csvContent +=
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",") + "\n";
    }

    // Create download link
    const encodedUri = encodeURI(csvContent);
    chrome.downloads.download({
      url: encodedUri,
      filename: "scraped_data.csv",
    });
  }
  return true;
});

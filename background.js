chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadData") {
    const recipes = request.recipes;
    const workbook = XLSX.utils.book_new();

    recipes.forEach((recipe) => {
      const data = [];
      const headers = recipe.attributes.map((attr) => attr.name);
      data.push(headers);

      const rows = [];
      const selectors = recipe.attributes.map((attr) => attr.selector);
      const elements = selectors.map((selector) =>
        document.querySelectorAll(selector),
      );

      const maxRows = Math.max(...elements.map((el) => el.length)); // Get max length of elements

      for (let i = 0; i < maxRows; i++) {
        const row = [];
        selectors.forEach((selector, index) => {
          const text = elements[index][i] ? elements[index][i].innerText : "";
          row.push(text);
        });
        rows.push(row);
      }
      data.push(...rows); // Add all extracted rows

      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, recipe.name);
    });

    XLSX.writeFile(workbook, "extracted_data.xlsx");
    sendResponse({ success: true });
  }
});

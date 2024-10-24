let selectedElements = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background:", message);
  if (message.action === "updateData") {
    selectedElements = message.data;
    console.log("Updated selectedElements:", selectedElements);
    sendResponse({ status: "Data updated successfully" });
  } else if (message.action === "downloadData") {
    console.log("Downloading data:", selectedElements);
    if (message.fileType === "excel") {
      saveToExcel(selectedElements);
    } else if (message.fileType === "word") {
      saveToWord(selectedElements);
    }
  }
  return true; // Indicates that the response is sent asynchronously
});

function saveToExcel(data) {
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Title,Content\n";
  data.forEach((item) => {
    csvContent += `"${item.title.replace(/"/g, '""')}","${item.content.replace(/"/g, '""')}"\n`;
  });
  let encodedUri = encodeURI(csvContent);
  chrome.downloads.download(
    {
      url: encodedUri,
      filename: "selected_components.csv",
    },
    () => {
      console.log("Excel file download initiated");
    },
  );
}

function saveToWord(data) {
  let content = "<html><body>";
  data.forEach((item) => {
    content += `<h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.content)}</p>`;
  });
  content += "</body></html>";
  let blob = new Blob([content], { type: "application/msword" });
  let url = URL.createObjectURL(blob);
  chrome.downloads.download(
    {
      url: url,
      filename: "selected_components.doc",
    },
    () => {
      console.log("Word file download initiated");
    },
  );
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

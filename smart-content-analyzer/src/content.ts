class ContentScraper {
  // Non-null assertion to satisfy TypeScript
  private overlay!: HTMLDivElement;
  private isSelectionMode = false;
  private selectedElements: Array<{ selector: string; text: string }> = [];

  constructor() {
    this.initializeOverlay();
    this.setupEventListeners();
  }

  // Separate method to create overlay
  private initializeOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #4CAF50;
      background: rgba(76, 175, 80, 0.1);
      z-index: 10000;
      display: none;
    `;
    document.body.appendChild(this.overlay);
  }

  // Rest of the implementation remains the same as in previous example
  // ... (other methods from previous implementation)
  private setupEventListeners() {
    document.addEventListener("mousemove", this.handleMouseMove.bind(this));
    document.addEventListener("click", this.handleClick.bind(this));
  }

  private handleMouseMove(event: MouseEvent) {
    if (!this.isSelectionMode) return;
    this.updateOverlay(event.target as HTMLElement);
  }

  private handleClick(event: MouseEvent) {
    if (!this.isSelectionMode) return;
    event.preventDefault();
    event.stopPropagation();

    const target = event.target as HTMLElement;
    const selector = this.getUniqueSelector(target);

    this.selectedElements.push({
      selector,
      text: target.textContent?.trim() || "",
    });

    // Send message to background script
    chrome.runtime.sendMessage({
      action: "elementSelected",
      selector,
      text: target.textContent?.trim(),
    });
  }

  private updateOverlay(element: HTMLElement | null) {
    if (!element) {
      this.overlay.style.display = "none";
      return;
    }
    const rect = element.getBoundingClientRect();
    this.overlay.style.display = "block";
    this.overlay.style.top = `${rect.top + window.scrollY}px`;
    this.overlay.style.left = `${rect.left + window.scrollX}px`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;
  }

  private getUniqueSelector(element: HTMLElement): string {
    const path: string[] = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let selector = element.tagName.toLowerCase();
      if (element.id) {
        selector = `#${element.id}`;
        path.unshift(selector);
        break;
      }
      if (element.className) {
        const classes = Array.from(element.classList)
          .filter((c) => !c.startsWith("_"))
          .join(".");
        if (classes) {
          selector += `.${classes}`;
        }
      }
      path.unshift(selector);
      element = element.parentElement as HTMLElement;
    }
    return path.join(" > ");
  }

  public startSelection() {
    this.isSelectionMode = true;
  }

  public stopSelection() {
    this.isSelectionMode = false;
    this.overlay.style.display = "none";
  }
}

// Conditional initialization to prevent errors in non-extension contexts
if (
  typeof window !== "undefined" &&
  typeof chrome !== "undefined" &&
  chrome.runtime
) {
  const scraper = new ContentScraper();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case "startSelection":
        scraper.startSelection();
        break;
      case "stopSelection":
        scraper.stopSelection();
        break;
    }
  });
}

export {}; // Explicitly export an empty object to make it a module

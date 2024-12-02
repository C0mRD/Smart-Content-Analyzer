async findConnectButton() {
    // First try direct connect button
    const directConnectSelectors = [
        'button[aria-label*="Connect"]',
        'button.artdeco-button--primary:not([disabled])',
        '[data-control-name="connect"]',
        'button.pvs-profile-actions__action:not([disabled])'
    ];

    // Check for direct connect button
    for (const selector of directConnectSelectors) {
        try {
            const buttons = document.querySelectorAll(selector);
            for (const button of buttons) {
                if (button?.textContent?.toLowerCase().includes('connect') && !button.disabled) {
                    console.log('Found direct connect button');
                    return { button, isDirectConnect: true };
                }
            }
        } catch (e) {
            console.log(`Selector ${selector} failed:`, e);
        }
    }

    // If no direct connect button, try More menu
    console.log('Direct connect button not found, trying More menu...');
    
    // Find More button
    const moreButtonSelectors = [
        'button.artdeco-dropdown-trigger',
        'button[aria-label*="More"]',
        'button.pvs-profile-actions__overflow-toggle',
        '.artdeco-dropdown__trigger',
        '.pvs-overflow-actions-dropdown__trigger'
    ];

    let moreButton = null;
    for (const selector of moreButtonSelectors) {
        const buttons = document.querySelectorAll(selector);
        for (const button of buttons) {
            const buttonText = button.textContent?.toLowerCase() || '';
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
            if (buttonText.includes('more') || ariaLabel.includes('more') || buttonText.includes('…')) {
                moreButton = button;
                console.log('Found More button:', buttonText || ariaLabel);
                break;
            }
        }
        if (moreButton) break;
    }

    if (moreButton) {
        console.log('Clicking More button...');
        moreButton.click();
        
        // Wait for dropdown to appear
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Look for Connect option in dropdown
        const dropdownConnectSelectors = [
            '.artdeco-dropdown__content-inner button',
            '.pvs-overflow-actions-dropdown__content button',
            'div.artdeco-dropdown__content li button',
            '.pvs-profile-actions__overflow-dropdown li button'
        ];

        for (const selector of dropdownConnectSelectors) {
            const menuItems = document.querySelectorAll(selector);
            for (const item of menuItems) {
                const itemText = item.textContent?.toLowerCase() || '';
                if (itemText.includes('connect')) {
                    console.log('Found Connect in dropdown');
                    return { button: item, isDirectConnect: false };
                }
            }
        }

        // If Connect not found in dropdown, close it and try alternative methods
        const closeButton = document.querySelector('button[aria-label*="Dismiss"]');
        if (closeButton) {
            closeButton.click();
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return null;
}

// Update handleLinkedInSearch to handle the new connect button response
async handleLinkedInSearch() {
    const nameInput = this.sidebar.querySelector("#linkedin-name");
    const statusDiv = this.sidebar.querySelector("#linkedin-status");
    const name = nameInput.value.trim();

    if (!name) {
        statusDiv.innerHTML = `<div style="color: red;">Please enter a name</div>`;
        return;
    }

    // Check if we're on LinkedIn
    if (!window.location.href.includes('linkedin.com')) {
        statusDiv.innerHTML = `
            <div style="color: red;">
                Please open LinkedIn first and try again.<br>
                <a href="https://www.linkedin.com/feed/" target="_blank">Go to LinkedIn</a>
            </div>
        `;
        return;
    }

    statusDiv.innerHTML = `<div style="color: #666;">Starting search process...</div>`;

    try {
        // Common LinkedIn selectors
        const searchSelectors = [
            'input[aria-label*="Search"]',
            'input[placeholder*="Search"]',
            'input.search-global-typeahead__input',
            '[role="combobox"]',
            '#global-nav-typeahead input'
        ];

        // Find search input using predefined selectors
        let searchInput = null;
        for (const selector of searchSelectors) {
            searchInput = document.querySelector(selector);
            if (searchInput) break;
        }

        // If common selectors fail, use Gemini
        if (!searchInput) {
            statusDiv.innerHTML = `<div style="color: #666;">Analyzing page structure...</div>`;
            const pageContext = await this.getPageContext();
            searchInput = await this.findElementByContext('search input', pageContext);
        }

        if (!searchInput) {
            throw new Error('Search bar not found. Please make sure you are logged into LinkedIn.');
        }

        // Simulate human-like typing
        statusDiv.innerHTML = `<div style="color: #666;">Searching for ${name}...</div>`;
        await this.simulateHumanTyping(searchInput, name);

        // Wait for dropdown or hit enter
        await new Promise(resolve => setTimeout(resolve, 1000));
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        // Wait for search results page
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify we're on search results page
        if (!window.location.href.includes('/search/')) {
            throw new Error('Search results page did not load properly');
        }

        // Enhanced person finding
        statusDiv.innerHTML = `<div style="color: #666;">Searching for ${name} in results...</div>`;
        const personCard = await this.findPersonInResults(name);
        
        if (!personCard) {
            // Try scrolling and searching again
            window.scrollTo(0, window.innerHeight);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const secondTry = await this.findPersonInResults(name);
            
            if (!secondTry) {
                throw new Error(`Could not find ${name} in search results. Please verify the name and try again.`);
            }
            personCard = secondTry;
        }

        // Log success and continue with profile opening
        console.log('Successfully found person card:', personCard);
        
        // Find clickable element
        const clickableElement = personCard.querySelector('a') || 
                               personCard.querySelector('[class*="link"]') ||
                               personCard.querySelector('[role="link"]');

        if (!clickableElement) {
            throw new Error('Found person but unable to click profile. Please try again.');
        }

        // Click on profile
        statusDiv.innerHTML = `<div style="color: #666;">Opening ${name}'s profile...</div>`;
        clickableElement.click();

        // Wait for profile to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Updated connect button handling
        const connectResult = await this.findConnectButton();
        if (connectResult) {
            const { button, isDirectConnect } = connectResult;
            button.click();
            
            // Wait for potential connection modal
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Handle connection modal if it appears
            const modalSelectors = [
                'button[aria-label*="Send now"]',
                'button[aria-label*="Connect"]',
                '.artdeco-modal__confirm-dialog-btn',
                '.send-invite__actions button'
            ];

            let modalButton = null;
            for (const selector of modalSelectors) {
                modalButton = document.querySelector(selector);
                if (modalButton) break;
            }

            if (modalButton) {
                console.log('Found modal button, confirming connection...');
                modalButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Verify the connection was sent
                const successIndicators = [
                    '.artdeco-toast-item--success',
                    '.artdeco-inline-feedback--success',
                    '[data-control-name="connect_success"]'
                ];

                const success = successIndicators.some(selector => 
                    document.querySelector(selector) !== null
                );

                if (success) {
                    statusDiv.innerHTML = `
                        <div style="color: green;">
                            ✓ Connection request sent to ${name}<br>
                            <small>Connection confirmed successfully</small>
                        </div>
                    `;
                } else {
                    throw new Error('Could not verify if connection was sent successfully');
                }
            } else {
                throw new Error('Connection modal not found after clicking connect');
            }
        } else {
            throw new Error('Could not find a way to connect. The person might have restricted connections or you may already be connected.');
        }

    } catch (error) {
        console.error('LinkedIn automation error:', error);
        statusDiv.innerHTML = `
            <div style="color: red;">
                Error: ${error.message}<br>
                <small>Details have been logged to console for debugging</small>
            </div>
        `;
    }
}


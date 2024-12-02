from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import google.generativeai as genai
from bs4 import BeautifulSoup
import json
import os
from dotenv import load_dotenv
import uvicorn
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import time

load_dotenv()

# Define safety settings for Gemini
safe = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini AI
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class PageData(BaseModel):
    url: str
    title: str
    html: str
    hostname: str

class LinkedInRequest(BaseModel):
    name: str

def identify_page_type(hostname: str) -> str:
    hostname = hostname.lower()

    if any(site in hostname for site in ['naukri', 'indeed', 'linkedin', 'monster', 'jobs']):
        return 'job'
    elif any(site in hostname for site in ['zomato', 'swiggy', 'yelp', 'foodpanda']):
        return 'restaurant'
    elif any(site in hostname for site in ['amazon', 'flipkart', 'ebay']):
        return 'product'
    elif any(site in hostname for site in ['magicbricks', '99acres', 'housing']):
        return 'property'

    return 'generic'

def create_extraction_prompt(page_type: str, html_sample: str) -> str:
    base_prompt = f"""
    Analyze this HTML content and extract multiple listings into a structured format.
    Each listing should be a separate item with specific fields based on the content type.

    Content type: {page_type}

    For each listing, extract the following fields based on the content type:
    """

    if page_type == 'job':
        fields = """
        - company_name: Company offering the job
        - job_title: Title/role of the position
        - location: Job location
        - salary: Salary information if available
        - experience: Required experience
        - skills: Required skills (comma-separated)
        - contact: Contact information if available
        - posted_date: When the job was posted
        """
    elif page_type == 'restaurant':
        fields = """
        - name: Restaurant name
        - cuisine: Type of cuisine
        - location: Restaurant location
        - rating: Rating if available
        - price_range: Price range or average cost
        - timing: Opening hours
        - features: Special features (comma-separated)
        - contact: Contact information
        """
    elif page_type == 'product':
        fields = """
        - name: Product name
        - price: Current price
        - brand: Brand name
        - category: Product category
        - rating: Product rating
        - availability: Stock status
        - seller: Seller name
        - delivery: Delivery information
        """
    elif page_type == 'property':
        fields = """
        - title: Property title
        - location: Property location
        - price: Property price
        - description: Brief description
        - area: Area of the property
        - type: Type of property (e.g., apartment, house)
        """
    else:
        fields = """
        - title: Title or main heading
        - description: Brief description
        - category: Category if applicable
        - date: Date if available
        - source: Source or author
        - additional_info: Any other relevant information
        """

    prompt = base_prompt + fields + """
    Return the data as a list of JSON objects, where each object represents one listing with the specified fields.
    If a field is not available, set it to an empty string. Doon't give me code just the data.

    HTML Content to analyze:
    """

    return prompt

@app.post("/extract-listings")
async def extract_listings(data: PageData):
    try:
        # Identify the type of page based on the hostname
        page_type = identify_page_type(data.hostname)

        # Create extraction prompt
        prompt = create_extraction_prompt(page_type, data.html)

        # Initialize Gemini model
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash-8b",  # Use the appropriate model name
            generation_config={"temperature": 0.5, "max_output_tokens": 8192, "top_p": 0.95, "top_k": 40, "response_mime_type": "application/json"},
            safety_settings=safe
        )

        # Add content to prompt
        prompt += data.html[:999000]  # Limit content length

        # Get Gemini response
        response = model.generate_content(prompt)

        # Print the raw response text for debugging
        print("Raw response from Gemini:", response.text)

        # Attempt to parse the response as JSON
        try:
            listings = json.loads(response.text)
        except json.JSONDecodeError:
            return {"success": False, "error": f"Failed to parse response: {response.text}"}

        if not isinstance(listings, list):
            listings = [listings]

        # Ensure all fields are present in each listing
        cleaned_listings = []
        for listing in listings:
            if isinstance(listing, dict):
                cleaned_listings.append(listing)

        if not cleaned_listings:
            return {"success": False, "error": "No listings found"}

        return {"success": True, "listings": cleaned_listings}

    except Exception as e:
        print(f"Extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

@app.post("/linkedin-connect")
async def linkedin_connect(data: LinkedInRequest):
    try:
        # Initialize Chrome in headless mode
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        driver = webdriver.Chrome(options=options)

        # Use Gemini to generate a search strategy
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash-8b",
            generation_config={"temperature": 0.7},
            safety_settings=safe
        )

        search_prompt = f"""
        Generate a LinkedIn search strategy for finding {data.name}.
        Include:
        1. Best search URL format
        2. Potential variations of the name
        3. Key identifiers to verify the correct profile
        Return as JSON with these fields.
        """

        response = model.generate_content(search_prompt)
        search_strategy = json.loads(response.text)

        # Implement the search and connect logic
        driver.get(f"https://www.linkedin.com/search/results/people/?keywords={data.name}")
        
        # Wait for results to load
        wait = WebDriverWait(driver, 10)
        results = wait.until(EC.presence_of_all_elements_located(
            (By.CSS_SELECTOR, ".search-result-card")
        ))

        # Process results
        for result in results[:3]:  # Look at top 3 results
            name_element = result.find_element(By.CSS_SELECTOR, ".name")
            if name_element.text.lower() == data.name.lower():
                connect_button = result.find_element(By.CSS_SELECTOR, ".connect-button")
                connect_button.click()
                time.sleep(1)  # Wait for modal
                
                # Click send in connect modal
                send_button = wait.until(EC.element_to_be_clickable(
                    (By.CSS_SELECTOR, ".send-invite-modal .submit-button")
                ))
                send_button.click()
                
                driver.quit()
                return {
                    "success": True,
                    "message": f"Connection request sent to {data.name}"
                }

        driver.quit()
        return {
            "success": False,
            "error": f"Could not find an exact match for {data.name}"
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/analyze-page")
async def analyze_page(data: dict):
    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash-8b",
            generation_config={"temperature": 0.3},
            safety_settings=safe
        )

        prompt = """
        Analyze this LinkedIn page HTML and identify reliable selectors for key elements.
        Focus on finding selectors that are:
        1. Stable across different LinkedIn versions
        2. Unique to the specific element
        3. Based on semantic meaning (aria-labels, roles, data-attributes)

        Specifically identify:
        1. Global search input
           - Look for aria-labels containing "Search"
           - Search-specific class names
           - Role="combobox" or "search" attributes
        
        2. Search result cards
           - Container elements with profile data
           - Elements with data-entity-type="PROFILE"
           - List items in search results
        
        3. Connect buttons
           - Primary action buttons
           - Elements with "Connect" text
           - Buttons with specific connection-related aria-labels

        Return JSON with:
        {
            "searchInput": ["selector1", "selector2"],
            "searchResults": ["selector1", "selector2"],
            "connectButton": ["selector1", "selector2"]
        }
        
        Only include selectors that are highly likely to be unique and stable.
        """

        response = model.generate_content(prompt + data['html'][:15000])
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/find-element")
async def find_element(data: dict):
    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash-8b",
            generation_config={"temperature": 0.3},
            safety_settings=safe
        )

        prompt = f"""
        Find the most reliable CSS selector for the {data['elementType']} on this LinkedIn page.
        Consider:
        1. Unique identifiers
        2. Aria labels
        3. Data attributes
        4. Class combinations
        Return only the most specific CSS selector as JSON with a 'selector' field.
        """

        response = model.generate_content(prompt + data['html'][:15000])
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/find-connect-button")
async def find_connect_button(data: dict):
    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash-8b",
            generation_config={"temperature": 0.3},
            safety_settings=safe
        )

        prompt = """
        Find the most reliable CSS selector for the Connect button on this LinkedIn profile page.
        Consider:
        1. Button text
        2. Aria labels
        3. Unique attributes
        Return only the CSS selector as JSON with a 'selector' field.
        """

        response = model.generate_content(prompt + json.dumps(data['context']))
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

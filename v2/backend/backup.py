# backend/main.py
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

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

GENERATION_CONFIG = {
    "temperature": 0.7,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
}

class PageData(BaseModel):
    url: str
    title: str
    html: str
    hostname: str

def identify_page_type(url: str, hostname: str, html: str) -> str:
    hostname = hostname.lower()
    url = url.lower()

    print(f"Identifying page type for URL: {url}")
    print(f"Hostname: {hostname}")

    # Job portals
    if any(site in hostname for site in ['naukri', 'indeed', 'linkedin', 'monster', 'jobs']):
        return 'job'

    # Restaurant listings
    elif any(site in hostname for site in ['zomato', 'swiggy', 'yelp', 'foodpanda']):
        return 'restaurant'

    # Government/Tender sites
    elif any(site in hostname for site in ['gov.in', 'tender', 'procurement']):
        return 'tender'

    # E-commerce
    elif any(site in hostname for site in ['amazon', 'flipkart', 'ebay', 'shop']):
        return 'product'

    # Real estate
    elif any(site in hostname for site in ['magicbricks', '99acres', 'housing', 'property']):
        return 'property'

    # Check if HTML content is valid
    if html:
        soup = BeautifulSoup(html, 'html.parser')
        text_content = soup.get_text().lower().strip()
        print(f"Text content: {text_content}")

        # Content-based checks
        if any(keyword in text_content for keyword in ['job', 'salary', 'experience', 'qualification']):
            return 'job'
        elif any(keyword in text_content for keyword in ['menu', 'restaurant', 'cuisine', 'food']):
            return 'restaurant'
        elif any(keyword in text_content for keyword in ['tender', 'bid', 'proposal', 'submission']):
            return 'tender'

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
    elif page_type == 'tender':
        fields = """
        - title: Tender title
        - reference_no: Tender reference number
        - organization: Issuing organization
        - value: Tender value if available
        - deadline: Submission deadline
        - category: Tender category
        - location: Project location
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
    If a field is not available, set it to an empty string.

    HTML Content to analyze:
    """

    return prompt

@app.post("/extract-listings")
async def extract_listings(data: PageData):
    try:
        # Initialize Gemini model
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash-8b",
            generation_config=GENERATION_CONFIG,
            safety_settings=safe
        )

        # Identify page type
        page_type = identify_page_type(data.url, data.hostname, data.html)

        # Create extraction prompt
        prompt = create_extraction_prompt(page_type, data.html)

        # Process HTML to extract main content area
        soup = BeautifulSoup(data.html, 'html.parser')

        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()

        # Get main content based on common patterns
        main_content = None
        for selector in ['main', '[role="main"]', '#content', '.content', 'article']:
            main_content = soup.select_one(selector)
            if main_content:
                break

        if not main_content:
            main_content = soup.body

        # Add content to prompt
        prompt += main_content.prettify()[:15000]  # Limit content length

        # Get Gemini response
        response = model.generate_content(prompt)

        try:
            # Parse response as JSON
            listings = json.loads(response.text)
            if not isinstance(listings, list):
                listings = [listings]

            # Ensure all fields are present in each listing
            cleaned_listings = []
            for listing in listings:
                if isinstance(listing, dict):
                    cleaned_listings.append(listing)

            return {"success": True, "listings": cleaned_listings}

        except json.JSONDecodeError:
            # Create a basic structure if JSON parsing fails
            return {"success": False, "error": "Failed to parse listings"}

    except Exception as e:
        print(f"Extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

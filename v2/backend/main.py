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

# Configure Gemini AI
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class PageData(BaseModel):
    url: str
    title: str
    html: str
    hostname: str

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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

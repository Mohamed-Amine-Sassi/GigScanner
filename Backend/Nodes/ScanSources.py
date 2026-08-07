import os
import re

from dotenv import load_dotenv
load_dotenv()
from tavily import TavilyClient
client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

from bs4 import BeautifulSoup

def clean_html(raw_html: str) -> str:
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    return soup.get_text(separator=" ", strip=True)

def detect_contact_method(description: str, url: str) -> dict:
    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", description)
    if email_match:
        return {"method": "email", "value": email_match.group()}
    return {"method": "apply_link", "value": url}


def scan_tanitjobs(query: str = "Agentic Ai freelance Job"):
    response = client.search(
        query=query,
        include_domains=["tanitjobs.com"],   # scopes the search to just this site
        search_depth="basic",                       # "advanced" costs more credits, not needed for this
        max_results=10,
        time_range="week", 
    )
    return response["results"]

def scan_linkedin(query: str):
    response = client.search(
        query=query,
        include_domains=["linkedin.com"],
        search_depth="basic",
        max_results=10,
        time_range="week", 
    )
    return response["results"]

import feedparser


def scan_weworkremotely(category: str ):
    url = f"https://weworkremotely.com/categories/{category}.rss"
    feed = feedparser.parse(url)

    postings = []
    for entry in feed.entries:
        raw_description = entry.get("summary", "")
        description = clean_html(raw_description)
        postings.append({
            "title": entry.title,
            "description": description,
            "url": entry.link,
            "source": "weworkremotely",
            "budget_text": None,
            "posted_date": entry.get("published", None),
            "contact": detect_contact_method(description, entry.link),
        })

    return postings

def normalize_tavily_results(results, source_name):
    return [
        {
            "title": r["title"],
            "description": clean_html(r["content"]),
            "url": r["url"],
            "source": source_name,
            "budget_text": None,
            "posted_date": None,
            "contact": detect_contact_method(clean_html(r["content"]), r["url"]),
        }
        for r in results
    ]

def scan_indeed(query: str):
    response = client.search(
        query=query,
        include_domains=["indeed.com"],
        search_depth="basic",
        max_results=10,
        time_range="week",
    )
    return response["results"]


def scan_glassdoor(query: str):
    response = client.search(
        query=query,
        include_domains=["glassdoor.com"],
        search_depth="basic",
        max_results=10,
        time_range="week",
    )
    return response["results"]


def scan_keejob(query: str = "Agentic Ai freelance Job"):
    response = client.search(
        query=query,
        include_domains=["keejob.com"],
        search_depth="basic",
        max_results=10,
        time_range="week",
    )
    return response["results"]


def scan_freelancer(query: str):
    response = client.search(
        query=query,
        include_domains=["freelancer.com"],
        search_depth="basic",
        max_results=10,
        time_range="week",
    )
    return response["results"]

def scan_sources_node(state):
    postings = []

    wwr_results = scan_weworkremotely("remote-programming-jobs")
    linkedin_results = scan_linkedin("Agentic Ai Jobs freelance")
    tanitjobs_results = scan_tanitjobs("Agentic Ai Jobs freelance")
    indeed_results = scan_indeed("Agentic Ai Jobs freelance remote")
    glassdoor_results = scan_glassdoor("Agentic Ai Jobs freelance remote")
    keejob_results = scan_keejob("Agentic Ai Jobs freelance")
    freelancer_results = scan_freelancer("Agentic Ai freelance project")

    postings.extend(wwr_results)
    postings.extend(normalize_tavily_results(tanitjobs_results, "tanitjobs"))
    postings.extend(normalize_tavily_results(linkedin_results, "Linkedin"))
    postings.extend(normalize_tavily_results(indeed_results, "Indeed"))
    postings.extend(normalize_tavily_results(glassdoor_results, "Glassdoor"))
    postings.extend(normalize_tavily_results(keejob_results, "Keejob"))
    postings.extend(normalize_tavily_results(freelancer_results, "Freelancer"))

    state["raw_postings"] = postings
    return state

# if __name__ == "__main__":
#     fake_state = {}
#     result_state = scan_sources_node(fake_state)
#     print(f"{len(result_state['raw_postings'])} postings in state")
#     print(result_state["raw_postings"][0])  # inspect one full record
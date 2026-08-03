import os
import re

from dotenv import load_dotenv
load_dotenv()
from tavily import TavilyClient

client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

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
    )
    return response["results"]

def scan_linkedin(query: str):
    response = client.search(
        query=query,
        include_domains=["linkedin.com"],
        search_depth="basic",
        max_results=10,
    )
    return response["results"]

import feedparser

def scan_weworkremotely(category: str ):
    url = f"https://weworkremotely.com/categories/{category}.rss"
    feed = feedparser.parse(url)

    postings = []
    for entry in feed.entries:
        postings.append({
            "title": entry.title,
            "description": entry.get("summary", ""),
            "url": entry.link,
            "source": "weworkremotely",
            "budget_text": None,          # WWR listings rarely state pay in the feed itself
            "posted_date": entry.get("published", None),
            "contact": detect_contact_method(entry.get("summary", ""), entry.link),
        })
    return postings

def normalize_tavily_results(results, source_name):
    return [
        {
            "title": r["title"],
            "description": r["content"],
            "url": r["url"],
            "source": source_name,
            "budget_text": None,
            "posted_date": None,
            "contact": detect_contact_method(r["content"], r["url"]),   
        }
        for r in results
    ]

def scan_sources_node(state):
    postings = []
    wwr_results = scan_weworkremotely("remote-programming-jobs")
    linkedin_results = scan_linkedin("Agentic Ai Jobs freelance")
    tanitjobs_results = scan_tanitjobs("Agentic Ai Jobs freelance")

    postings.extend(wwr_results)
    postings.extend(normalize_tavily_results(tanitjobs_results, "tanitjobs"))
    postings.extend(normalize_tavily_results( linkedin_results, "Linkedin"))
    
    state["raw_postings"] = postings
    return state

# if __name__ == "__main__":
#     fake_state = {}
#     result_state = scan_sources_node(fake_state)
#     print(f"{len(result_state['raw_postings'])} postings in state")
#     print(result_state["raw_postings"][0])  # inspect one full record
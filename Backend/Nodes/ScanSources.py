import os
import re
import requests

from dotenv import load_dotenv
load_dotenv()
from tavily import TavilyClient
client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
import re
import feedparser
from playwright.sync_api import sync_playwright

from bs4 import BeautifulSoup

# Minimum Tavily relevance score to keep a result. Tune this: start at 0.3
# and raise/lower based on how many good postings you're losing vs how much
# junk still gets through.
MIN_RELEVANCE_SCORE = 0.3

# Static User-Agent reused for lightweight requests-based checks
DEFAULT_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
)

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


# English + French patterns. tanitjobs / keejob are Tunisian boards and often
# render in French, so an English-only list misses most of their closed banners.
CLOSED_PATTERNS = [
    "no longer accepting applications",
    "no longer accepting applicants",
    "no longer accepting job applications",
    "this job is no longer available",
    "position has been filled",
    "job posting is closed",
    "this position is no longer accepting",
    "ne recrute plus",
    "offre pourvue",
    "poste pourvu",
    "cette offre n'est plus disponible",
    "offre expirée",
    "recrutement clôturé",
    "candidature clôturée",
    "cette annonce est expirée",
]

def linkedin_job_is_closed(url: str) -> bool:
    """
    Open the actual LinkedIn job page and check its rendered text
    for signs that the job is closed/expired.
    """
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(user_agent=DEFAULT_UA)
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)
            text = page.locator("body").inner_text().lower()
            browser.close()

            for pattern in CLOSED_PATTERNS:
                if pattern in text:
                    return True
            return False
    except Exception:
        # Don't automatically mark it as closed if verification failed.
        return False


def is_posting_closed_live(url: str, timeout: int = 10) -> bool:
    """
    Lightweight closed-status check for static/server-rendered boards
    (tanitjobs, keejob, indeed, glassdoor) that doesn't need a browser.
    Falls back to 'not closed' on any error so we never drop a good
    posting because of a network hiccup.
    """
    try:
        resp = requests.get(url, timeout=timeout, headers={"User-Agent": DEFAULT_UA})
        if resp.status_code >= 400:
            return False
        text = clean_html(resp.text).lower()
        return any(pattern in text for pattern in CLOSED_PATTERNS)
    except Exception:
        return False


def is_linkedin_job_url(url: str) -> bool:
    """Keep only actual job postings, drop profiles/companies/articles/etc."""
    return "/jobs/view/" in url


def is_closed_posting(content: str) -> bool:
    """Best-effort check against text snippets for common 'closed' phrasing."""
    if not content:
        return False
    text = content.lower()
    return any(phrase in text for phrase in CLOSED_PATTERNS)


def scan_tanitjobs(query: str = "Agentic Ai freelance Job"):
    response = client.search(
        query=query,
        include_domains=["tanitjobs.com"],
        search_depth="basic",
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

    results = response["results"]
    verified_results = []

    for r in results:
        if r.get("score", 0) < MIN_RELEVANCE_SCORE:
            continue

        url = r.get("url", "")
        if not is_linkedin_job_url(url):
            continue
        if linkedin_job_is_closed(url):
            continue

        verified_results.append(r)

    return verified_results


def scan_weworkremotely(category: str):
    url = f"https://weworkremotely.com/categories/{category}.rss"
    feed = feedparser.parse(url)

    postings = []
    for entry in feed.entries:
        raw_description = entry.get("summary", "")
        description = clean_html(raw_description)
        if is_closed_posting(description):
            continue
        postings.append({
            "title": entry.title,
            "description": description,
            "url": entry.link,
            "source": "weworkremotely",
            "budget_text": None,
            "posted_date": entry.get("published", None),
            "relevance_score": None,  # RSS has no relevance score to filter on
            "contact": detect_contact_method(description, entry.link),
        })

    return postings

def normalize_tavily_results(results, source_name, verify_live=False):
    """
    verify_live: if True, does a second live fetch of each surviving URL
    to catch closed postings that Tavily's snippet didn't reveal. This is
    slower (one extra HTTP request per posting) so it's off by default —
    turn it on for boards you've seen leak the most closed postings.
    """
    postings = []
    for r in results:
        score = r.get("score", 0)
        if score < MIN_RELEVANCE_SCORE:
            continue

        content = clean_html(r["content"])
        if is_closed_posting(content):
            continue

        if verify_live and is_posting_closed_live(r["url"]):
            continue

        postings.append({
            "title": r["title"],
            "description": content,
            "url": r["url"],
            "source": source_name,
            "budget_text": None,
            "posted_date": None,
            "relevance_score": score,
            "contact": detect_contact_method(content, r["url"]),
        })
    return postings

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


def scan_sources_node(state):
    postings = []

    wwr_results = scan_weworkremotely("remote-programming-jobs")
    linkedin_results = scan_linkedin("Agentic Ai Jobs freelance")
    tanitjobs_results = scan_tanitjobs("Agentic Ai Jobs freelance")
    indeed_results = scan_indeed("Agentic Ai Jobs freelance remote")
    glassdoor_results = scan_glassdoor("Agentic Ai Jobs freelance remote")
    keejob_results = scan_keejob("Agentic Ai Jobs freelance")

    postings.extend(wwr_results)
    # verify_live=True on the smaller, static Tunisian boards — cheap enough
    # to do per-posting and where snippet-only detection misses the most.
    postings.extend(normalize_tavily_results(tanitjobs_results, "tanitjobs", verify_live=True))
    postings.extend(normalize_tavily_results(linkedin_results, "Linkedin"))
    postings.extend(normalize_tavily_results(indeed_results, "Indeed"))
    postings.extend(normalize_tavily_results(glassdoor_results, "Glassdoor"))
    postings.extend(normalize_tavily_results(keejob_results, "Keejob", verify_live=True))

    state["raw_postings"] = postings
    return state
import os
import json
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

llm = Groq(api_key=os.getenv("GROQ_API_KEY"))

YOUR_PROFILE = """
Second-year software engineering student, based in Tunisia, trilingual (French/Arabic/English).
Skilled in LangGraph, LangChain, AI agent development, and the MERN stack (React, Node, MongoDB, Express).
Prefers AI/agent work over generic CRUD projects, but open to solid MERN gigs.
"""


def draft_pitch_for_posting(posting: dict) -> dict:
    prompt = f"""
You are writing a short freelance pitch/proposal from this profile:
{YOUR_PROFILE}

Job posting:
Title: {posting['title']}
Description: {posting['description']}

Write a short pitch (3-5 sentences) that:
- References something specific from the posting, not generic filler
- Matches the language the posting is written in (French or English)
- Sounds like a real person, not a template
- Ends with a simple call to action (e.g. asking to discuss further)

Respond with ONLY the pitch text, no preamble, no markdown, no quotation marks around it.
"""
    try:
        response = llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            max_tokens=300,
        )
        pitch_text = response.choices[0].message.content.strip()
        posting["pitch"] = pitch_text
        posting["pitch_status"] = "drafted"
    except Exception as e:
        posting["pitch"] = None
        posting["pitch_status"] = f"failed: {type(e).__name__}"

    return posting


def draft_pitch_node(state):
    top_candidates = state.get("top_candidates", [])

    email_candidates = [p for p in top_candidates if p.get("contact", {}).get("method") == "email"]
    no_email_candidates = [p for p in top_candidates if p.get("contact", {}).get("method") != "email"]

    drafted = [draft_pitch_for_posting(p) for p in email_candidates]

    state["drafts"] = drafted
    state["no_email_candidates"] = no_email_candidates
    return state



# if __name__ == "__main__":
#     fake_state = {
#         "top_candidates": [
#             {
#                 "title": "LangGraph developer needed for AI agent MVP",
#                 "description": "We're building a customer support agent using LangGraph and need someone to help design the multi-agent flow.",
#                 "url": "https://example.com/job/1",
#                 "source": "tanitjobs",
#                 "fit_score": 82.0,
#                 "reasons": ["skill match: langgraph, ai agent"],
#             },
#         ]
#     }
#     result = draft_pitch_node(fake_state)
#     for p in result["drafts"]:
#         print(p["title"])
#         print("---")
#         print(p["pitch"])
#         print(f"status: {p['pitch_status']}\n")
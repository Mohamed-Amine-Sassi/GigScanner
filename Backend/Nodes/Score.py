import os
import re
import json
from datetime import datetime
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

llm = Groq(api_key=os.getenv("GROQ_API_KEY"))

SKILL_KEYWORDS = {
    "langgraph": 15,
    "langchain": 12,
    "agentic ai": 15,
    "ai agent": 12,
    "react": 8,
    "node.js": 8,
    "mern": 10,
    "mongodb": 6,
    "express": 6,
    "python": 8,
}

RED_FLAGS = ["unpaid", "equity only", "long-term unpaid trial", "no budget"]

MIN_SCORE_THRESHOLD = 25

YOUR_PROFILE = {
    "level": "student",
    "location": "Tunisia",
    "languages": ["French", "Arabic", "English"],

    "strong_skills": [
        "LangGraph",
        "LangChain",
        "AI agents",
        "Python",
        "React",
        "Node.js",
        "MongoDB",
        "Express"
    ],

    "preferred_work": [
        "AI agents",
        "LLM applications",
        "RAG",
        "LangGraph",
        "LangChain"
    ],

    "acceptable_work": [
        "MERN",
        "React",
        "Node.js",
        "full-stack development"
    ],

    "avoid": [
        "unpaid work",
        "long unpaid trials"
    ]
}


def check_red_flags(text: str) -> list[str]:
    text_lower = text.lower()
    return [flag for flag in RED_FLAGS if flag in text_lower]

def score_skill_match(text: str) -> tuple[int, list[str]]:
    text_lower = text.lower()
    score = 0
    matched = []
    for keyword, weight in SKILL_KEYWORDS.items():
        if keyword in text_lower:
            score += weight
            matched.append(keyword)
    return score, matched


def llm_judge_posting(posting: dict) -> dict:
    prompt = f"""
You are evaluating a freelance job posting for fit against this profile:
{json.dumps(YOUR_PROFILE)}

Posting title: {posting['title']}
Posting description: {posting['description']}

Respond in this exact JSON format, nothing else, no markdown fences:
{{"score": <integer 0-100>, "reason": "<one sentence why>", "concern": "<one sentence red flag if any, or null>"}}
"""
    try:
        response = llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=200,
        )
        raw = response.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(raw)

        if not isinstance(parsed.get("score"), (int, float)):
            raise ValueError("score missing or wrong type")

        return {
            "score": int(parsed["score"]),
            "reason": parsed.get("reason", "no reason given"),
            "concern": parsed.get("concern"),
        }
    except (json.JSONDecodeError, ValueError, KeyError, Exception) as e:
        return {
            "score": 0,
            "reason": f"LLM judgment failed ({type(e).__name__}) — manual review needed",
            "concern": "unparseable or failed LLM response",
        }


def hybrid_score(posting: dict) -> dict:
    full_text = f"{posting['title']} {posting['description']}"

    # Stage 1a: hard red flags -> auto-reject, no LLM call spent
    flags = check_red_flags(full_text)
    if flags:
        return {**posting, "fit_score": 0, "reasons": [f"red flag: {flags[0]}"]}

    # Stage 1b: zero skill relevance -> auto-reject, no LLM call spent
    deterministic_score, matched = score_skill_match(full_text)
    if deterministic_score == 0:
        return {**posting, "fit_score": 0, "reasons": ["no skill relevance detected"]}

    # Stage 2: survived the filter -> worth an LLM judgment call
    llm_result = llm_judge_posting(posting)
    final_score = round((deterministic_score * 0.3) + (llm_result["score"] * 0.7), 1)

    reasons = [f"skill match: {', '.join(matched)}", llm_result["reason"]]
    if llm_result.get("concern"):
        reasons.append(f"concern: {llm_result['concern']}")

    return {**posting, "fit_score": final_score, "reasons": reasons}


def score_fit_node(state):
    scored = [hybrid_score(p) for p in state["new_postings"]]
    state["scored_postings"] = scored
    return state


def has_qualifying_postings(state) -> str:
    if any(p["fit_score"] >= MIN_SCORE_THRESHOLD for p in state["scored_postings"]):
        return "rank_top_n"
    return "end"


# if __name__ == "__main__":
#     fake_postings = [
#         {
#             "title": "Looking for LangGraph developer for AI agent project",
#             "description": "We need someone skilled in LangChain and Python to build a multi-agent customer support system. Budget flexible for the right person.",
#         },
#         {
#             "title": "Unpaid internship - React developer",
#             "description": "Great opportunity, unpaid trial period first, possible pay later.",
#         },
#         {
#             "title": "Need a plumber for bathroom renovation",
#             "description": "Looking for experienced plumber in Tunis area.",
#         },
#     ]
#
#     for p in fake_postings:
#         result = hybrid_score(p)
#         print(f"\n{result['title']}")
#         print(f"  score: {result['fit_score']}")
#         print(f"  reasons: {result['reasons']}")
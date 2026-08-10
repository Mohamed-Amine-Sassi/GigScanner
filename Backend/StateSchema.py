
from typing import TypedDict

class GigScannerState(TypedDict):
    user_id: str
    raw_postings: list[dict]       # from scan_sources
    new_postings: list[dict]       # after dedupe
    scored_postings: list[dict]    # gig + fit_score + reasons
    top_candidates: list[dict]     # after rank_top_n, capped e.g. top 5
    drafts: list[dict]             # {gig, pitch_text, status}
    approved: list[dict]
    discarded: list[dict]
    
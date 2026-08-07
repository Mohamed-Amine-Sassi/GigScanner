from langgraph.graph import StateGraph, END
from dotenv import load_dotenv

from Nodes.HumanReview import human_review_node
from StateSchema import GigScannerState
from Nodes.ScanSources import scan_sources_node
from Nodes.DedupeCheck import dedupe_check_node
from Nodes.Score import score_fit_node, has_qualifying_postings, MIN_SCORE_THRESHOLD
from Nodes.RankTopNNode import rank_top_n_node
from Nodes.DraftPitch import draft_pitch_node
from langgraph.graph import StateGraph, END

load_dotenv()


def build_graph(checkpointer=None):
    graph = StateGraph(GigScannerState)

    graph.add_node("scan_sources", scan_sources_node)
    graph.add_node("dedupe_check", dedupe_check_node)
    graph.add_node("score_fit", score_fit_node)
    graph.add_node("rank_top_n", rank_top_n_node)   
    graph.add_node("draft_pitch", draft_pitch_node)
    graph.add_node("human_review", human_review_node)   

    graph.set_entry_point("scan_sources")
    graph.add_edge("scan_sources", "dedupe_check")
    graph.add_edge("dedupe_check", "score_fit")

    graph.add_conditional_edges(
        "score_fit",
        has_qualifying_postings,
        {
            "rank_top_n": "rank_top_n",
            "end": END,
        },
    )

    graph.add_edge("rank_top_n", "draft_pitch")   
    graph.add_edge("draft_pitch", "human_review")   
    graph.add_edge("human_review", END)             
    return graph.compile(checkpointer=checkpointer)


"""
if __name__ == "__main__":
    fake_state = {
        "top_candidates": [
            {
                "title": "LangGraph developer needed for AI agent MVP",
                "description": "We're building a customer support agent using LangGraph and need someone to help design the multi-agent flow.",
                "url": "https://example.com/job/1",
                "source": "tanitjobs",
                "fit_score": 82.0,
                "reasons": ["skill match: langgraph, ai agent"],
            },
        ]
    }
    result = draft_pitch_node(fake_state)
    for p in result["drafts"]:
        print(p["title"])
        print("---")
        print(p["pitch"])
        print(f"status: {p['pitch_status']}\n")
"""
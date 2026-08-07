from langgraph.graph import StateGraph, END
from dotenv import load_dotenv

from Nodes.HumanReview import human_review_node
from StateSchema import GigScannerState
from Nodes.ScanSources import scan_sources_node
from Nodes.DedupeCheck import dedupe_check_node
from Nodes.Score import score_fit_node, has_qualifying_postings, MIN_SCORE_THRESHOLD
from Nodes.RankTopNNode import rank_top_n_node
from Nodes.DraftPitch import draft_pitch_node
from mcp_setup import get_send_email_tool
from Nodes.SendEmail import send_email_node
load_dotenv()


async def build_graph(checkpointer=None):

    

    graph = StateGraph(GigScannerState)

    graph.add_node("scan_sources", scan_sources_node)
    graph.add_node("dedupe_check", dedupe_check_node)
    graph.add_node("score_fit", score_fit_node)
    graph.add_node("rank_top_n", rank_top_n_node)
    graph.add_node("draft_pitch", draft_pitch_node)
    graph.add_node("human_review", human_review_node)
    graph.add_node("send_email", send_email_node)



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
    graph.add_edge("human_review", "send_email")
    graph.add_edge("send_email", END)

    return graph.compile(checkpointer=checkpointer)
from Nodes.Score import MIN_SCORE_THRESHOLD
TOP_N = 5

def rank_top_n_node(state):
    scored = state.get("scored_postings", [])

    qualifying = [p for p in scored if p["fit_score"] >= MIN_SCORE_THRESHOLD]
    qualifying_sorted = sorted(qualifying, key=lambda p: p["fit_score"], reverse=True)

    top_candidates = qualifying_sorted[:TOP_N]
    also_seen = qualifying_sorted[TOP_N:]  # didn't make the cut but still qualified

    state["top_candidates"] = top_candidates
    state["also_seen"] = also_seen

    return state
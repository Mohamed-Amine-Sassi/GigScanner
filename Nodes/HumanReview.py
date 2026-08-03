from langgraph.types import interrupt

def human_review_node(state):
    drafts = state.get("drafts", [])

    # This pauses graph execution here and hands `drafts` back to whatever
    # called .invoke() — execution won't continue past this line until
    # the graph is resumed with a matching Command(resume=...)
    decisions = interrupt({"drafts": drafts})

    approved = []
    discarded = []

    for decision in decisions:
        matching = next((d for d in drafts if d["url"] == decision["url"]), None)
        if matching is None:
            continue

        if decision["decision"] == "approve":
            # allow the human-edited pitch to override the AI-drafted one
            matching["pitch"] = decision.get("edited_pitch", matching["pitch"])
            approved.append(matching)
        else:
            discarded.append(matching)

    state["approved"] = approved
    state["discarded"] = discarded
    return state
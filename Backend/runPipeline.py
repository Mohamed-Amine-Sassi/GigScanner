# run_pipeline.py
import json
from langgraph.checkpoint.sqlite import SqliteSaver

from Main import build_graph  # your existing build_graph(), unchanged

THREAD_CONFIG = {"configurable": {"thread_id": "gig-scanner-run-1"}}


def dump_json(data, filename):
    with open(filename, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)


def main():
    with SqliteSaver.from_conn_string("checkpoints.db") as checkpointer:
        app = build_graph(checkpointer=checkpointer)
        result = app.invoke({}, config=THREAD_CONFIG)

        # snapshot the state so the React UI has something to read
        state_snapshot = app.get_state(THREAD_CONFIG).values
        scored = state_snapshot.get("scored_postings") or state_snapshot.get("raw_postings", [])
        dump_json(scored, "raw_postings.json")
        dump_json(state_snapshot.get("top_candidates", []), "ranked_postings.json")

        # If human_review triggered an interrupt, result contains it
        if "__interrupt__" in result:
            drafts = result["__interrupt__"][0].value["drafts"]

            review_queue = [
                {
                    "url": d["url"],
                    "title": d["title"],
                    "source": d["source"],
                    "fit_score": d["fit_score"],
                    "email": d["contact"]["value"],
                    "pitch_status": d.get("pitch_status", "unknown"),
                    "pitch": d["pitch"],
                    "decision": "pending",
                    "edited_pitch": d["pitch"],
                }
                for d in drafts
            ]

            with open("review_queue.json", "w") as f:
                json.dump(review_queue, f, indent=2, ensure_ascii=False)

            print(f"{len(review_queue)} drafts written to review_queue.json — edit it, then run resume_review.py")
        else:
            print("No pitches needed review this run.")


if __name__ == "__main__":
    main()
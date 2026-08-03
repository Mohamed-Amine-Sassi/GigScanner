# run_pipeline.py
import json
from langgraph.checkpoint.sqlite import SqliteSaver

from Main import build_graph  # your existing build_graph(), unchanged

THREAD_CONFIG = {"configurable": {"thread_id": "gig-scanner-run-1"}}

def main():
    with SqliteSaver.from_conn_string("checkpoints.db") as checkpointer:
        app = build_graph(checkpointer=checkpointer)  # see note below
        result = app.invoke({}, config=THREAD_CONFIG)

        # If human_review triggered an interrupt, result contains it
        if "__interrupt__" in result:
            drafts = result["__interrupt__"][0].value["drafts"]

            review_queue = [
                {
                    "url": d["url"],
                    "title": d["title"],
                    "source": d["source"],
                    "fit_score": d["fit_score"],
                    "pitch": d["pitch"],
                    "decision": "pending",       # you'll change this to "approve" or "discard"
                    "edited_pitch": d["pitch"],  # you can edit this text directly
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
# resume_review.py
import json
from unittest import result
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import Command

from Main import build_graph

THREAD_CONFIG = {"configurable": {"thread_id": "gig-scanner-run-1"}}  

def main():
    with open("review_queue.json") as f:
        review_queue = json.load(f)

    decisions = [
        {"url": item["url"], "decision": item["decision"], "edited_pitch": item["edited_pitch"]}
        for item in review_queue
    ]

    with SqliteSaver.from_conn_string("checkpoints.db") as checkpointer:
        app = build_graph(checkpointer=checkpointer)
        result = app.invoke(Command(resume=decisions), config=THREAD_CONFIG)
        
    print(f"{len(result.get('approved', []))} approved, {len(result.get('discarded', []))} discarded")

if __name__ == "__main__":
    main()
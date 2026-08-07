import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default dev port
    allow_methods=["*"],
    allow_headers=["*"],
)

def read_json(filename: str):
    path = Path(filename)
    if not path.exists():
        return []
    with open(path) as f:
        return json.load(f)

def write_json(filename: str, data):
    with open(filename, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


@app.get("/api/raw-postings")
def get_raw_postings():
    return read_json("raw_postings.json")


@app.get("/api/ranked-postings")
def get_ranked_postings():
    return read_json("ranked_postings.json")


@app.get("/api/drafts")
def get_drafts():
    return read_json("review_queue.json")


class DecisionUpdate(BaseModel):
    decision: str          # "approve", "discard", or "pending"
    edited_pitch: str


@app.patch("/api/drafts/{url:path}")
def update_decision(url: str, update: DecisionUpdate):
    drafts = read_json("review_queue.json")
    for d in drafts:
        if d["url"] == url:
            d["decision"] = update.decision
            d["edited_pitch"] = update.edited_pitch
            write_json("review_queue.json", drafts)
            return {"status": "updated"}
    raise HTTPException(status_code=404, detail="draft not found")
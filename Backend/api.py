import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from mcp_setup import get_send_email_tool


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
    with open(path,"r", encoding="utf-8") as f:
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

@app.post("/api/drafts/{url:path}/send")
async def send_single(url: str):
    drafts = read_json("review_queue.json")
    draft = next((d for d in drafts if d["url"] == url), None)
    if not draft:
        raise HTTPException(status_code=404, detail="draft not found")

    recipient = draft.get("email")
    if not recipient:
        raise HTTPException(status_code=400, detail="no email contact on this posting")

    send_email_tool = await get_send_email_tool()
    result = await send_email_tool.ainvoke({
        "to": [recipient],
        "subject": f"Re: {draft.get('title', 'your posting')}",
        "body": draft.get("edited_pitch") or draft.get("pitch", ""),
    })

    draft["decision"] = "approve"
    draft["send_result"] = result
    write_json("review_queue.json", drafts)

    return {"status": "sent", "result": result}

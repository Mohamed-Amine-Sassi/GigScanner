import os
import hashlib
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def make_key(posting: dict) -> str:
    raw = f"{posting['source']}:{posting['title']}:{posting.get('posted_date', '')}"
    return hashlib.sha256(raw.encode()).hexdigest()

def dedupe_check_node(state):
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cur = conn.cursor()

    new_postings = []
    for posting in state["raw_postings"]:
        key = make_key(posting)
        posting["_dedupe_key"] = key
        cur.execute("SELECT 1 FROM seen_postings WHERE key = %s", (key,))
        if cur.fetchone() is None:
            new_postings.append(posting)

    cur.close()
    conn.close()
    state["new_postings"] = new_postings
    return state
import json
import os
from pathlib import Path

import psycopg2
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()


# ============================================================
# CONFIG
# ============================================================

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.settings.basic",
]

CLIENT_SECRETS_FILE = "gcp-oauth-web.json"

REDIRECT_URI = "http://localhost:8000/auth/google/callback"

FRONTEND_URL = "http://localhost:5173"


# ============================================================
# APP
# ============================================================

app = FastAPI()


# Session middleware
# Used to preserve OAuth state + PKCE code verifier
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get(
        "SESSION_SECRET",
        "dev-secret-change-me"
    ),
)


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# GMAIL TOKEN STORAGE
# ============================================================

def save_refresh_token(
    user_id: str,
    email: str,
    refresh_token: str
):
    conn = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        database=os.getenv("POSTGRES_DB", "project"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD"),
    )

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO gmail_credentials
                    (user_id, email, refresh_token)
                VALUES
                    (%s, %s, %s)
                ON CONFLICT (user_id)
                DO UPDATE SET
                    email = EXCLUDED.email,
                    refresh_token = EXCLUDED.refresh_token
                """,
                (
                    user_id,
                    email,
                    refresh_token
                )
            )

        conn.commit()

    finally:
        conn.close()


# ============================================================
# JSON HELPERS
# ============================================================

def read_json(filename: str):
    path = Path(filename)

    if not path.exists():
        return []

    with open(filename, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(filename: str, data):
    with open(
        filename,
        "w",
        encoding="utf-8"
    ) as f:
        json.dump(
            data,
            f,
            indent=2,
            ensure_ascii=False
        )


# ============================================================
# POSTINGS
# ============================================================

@app.get("/api/raw-postings")
def get_raw_postings():
    return read_json("raw_postings.json")


@app.get("/api/ranked-postings")
def get_ranked_postings():
    return read_json("ranked_postings.json")


@app.get("/api/drafts")
def get_drafts():
    return read_json("review_queue.json")


# ============================================================
# DRAFT UPDATE
# ============================================================

class DecisionUpdate(BaseModel):
    decision: str
    edited_pitch: str


@app.patch("/api/drafts/{url:path}")
def update_decision(
    url: str,
    update: DecisionUpdate
):
    drafts = read_json("review_queue.json")

    for d in drafts:
        if d["url"] == url:
            d["decision"] = update.decision
            d["edited_pitch"] = update.edited_pitch

            write_json(
                "review_queue.json",
                drafts
            )

            return {
                "status": "updated"
            }

    raise HTTPException(
        status_code=404,
        detail="draft not found"
    )


# ============================================================
# GOOGLE GMAIL OAUTH - LOGIN
# ============================================================

@app.get("/auth/google/login")
def login(request: Request):

    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )

    auth_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
    )

    # --------------------------------------------------------
    # IMPORTANT:
    # Save OAuth state and PKCE verifier in the user's session.
    #
    # The verifier is required later when Google sends us
    # back to /auth/google/callback.
    # --------------------------------------------------------

    request.session["oauth_state"] = state

    request.session["oauth_code_verifier"] = (
        flow.code_verifier
    )

    return RedirectResponse(
        url=auth_url
    )


# ============================================================
# GOOGLE GMAIL OAUTH - CALLBACK
# ============================================================

@app.get("/auth/google/callback")
def callback(
    request: Request,
    code: str,
    state: str,
):

    # --------------------------------------------------------
    # Retrieve the values saved during /login
    # --------------------------------------------------------

    saved_state = request.session.get(
        "oauth_state"
    )

    code_verifier = request.session.get(
        "oauth_code_verifier"
    )

    # --------------------------------------------------------
    # Validate OAuth state
    # --------------------------------------------------------

    if not saved_state:
        raise HTTPException(
            status_code=400,
            detail="OAuth session expired or missing state"
        )

    if state != saved_state:
        raise HTTPException(
            status_code=400,
            detail="Invalid OAuth state"
        )

    # --------------------------------------------------------
    # Make sure PKCE verifier exists
    # --------------------------------------------------------

    if not code_verifier:
        raise HTTPException(
            status_code=400,
            detail="Missing OAuth code verifier"
        )

    # --------------------------------------------------------
    # Recreate the OAuth flow
    # --------------------------------------------------------

    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        state=saved_state,
        redirect_uri=REDIRECT_URI,
    )

    # --------------------------------------------------------
    # IMPORTANT:
    # Restore the verifier generated during /login
    # --------------------------------------------------------

    flow.code_verifier = code_verifier

    # --------------------------------------------------------
    # Exchange Google's authorization code for tokens
    # --------------------------------------------------------

    flow.fetch_token(
        code=code
    )

    creds = flow.credentials

    # --------------------------------------------------------
    # Get the Gmail account email
    # --------------------------------------------------------

    service = build(
        "gmail",
        "v1",
        credentials=creds
    )

    profile = (
        service
        .users()
        .getProfile(userId="me")
        .execute()
    )

    user_email = profile["emailAddress"]

    # --------------------------------------------------------
    # Save refresh token in PostgreSQL
    # --------------------------------------------------------

    if not creds.refresh_token:
        raise HTTPException(
            status_code=400,
            detail="Google did not return a refresh token"
        )

    save_refresh_token(
        user_id=user_email,
        email=user_email,
        refresh_token=creds.refresh_token
    )

    # --------------------------------------------------------
    # Clean up temporary OAuth session data
    # --------------------------------------------------------

    request.session.pop(
        "oauth_state",
        None
    )

    request.session.pop(
        "oauth_code_verifier",
        None
    )

    # --------------------------------------------------------
    # Send user back to React
    # --------------------------------------------------------

    return RedirectResponse(
        url=(
            f"{FRONTEND_URL}/"
            f"?gmail_connected=true"
            f"&email={user_email}"
        )
    )
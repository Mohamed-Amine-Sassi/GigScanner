
import json
import os
import sys
import base64
import psycopg2

from pathlib import Path
from dotenv import load_dotenv

from mcp.server.fastmcp import FastMCP

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build

from email.mime.text import MIMEText


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

# Backend directory:
# /home/medamine/Desktop/Project/Backend
BASE_DIR = Path(__file__).resolve().parent

# Load .env from the Backend directory
ENV_FILE = BASE_DIR / ".env"
load_dotenv(ENV_FILE)


# ============================================================
# GOOGLE OAUTH CONFIGURATION
# ============================================================

OAUTH_FILE = BASE_DIR / "gcp-oauth-web.json"

if not OAUTH_FILE.exists():
    raise FileNotFoundError(
        f"Google OAuth file not found: {OAUTH_FILE}"
    )

with open(OAUTH_FILE, "r", encoding="utf-8") as f:
    oauth_data = json.load(f)

if "web" not in oauth_data:
    raise ValueError(
        "gcp-oauth-web.json does not contain a 'web' section."
    )

oauth_config = oauth_data["web"]

GOOGLE_CLIENT_ID = oauth_config["client_id"]
GOOGLE_CLIENT_SECRET = oauth_config["client_secret"]
GOOGLE_TOKEN_URI = oauth_config.get(
    "token_uri",
    "https://oauth2.googleapis.com/token"
)


# ============================================================
# DEBUG INFORMATION
# ============================================================

print(
    f"[GMAIL MCP] BASE_DIR: {BASE_DIR}",
    file=sys.stderr,
)

print(
    f"[GMAIL MCP] OAuth file: {OAUTH_FILE}",
    file=sys.stderr,
)

print(
    f"[GMAIL MCP] OAuth file exists: {OAUTH_FILE.exists()}",
    file=sys.stderr,
)

print(
    f"[GMAIL MCP] Client ID loaded: {bool(GOOGLE_CLIENT_ID)}",
    file=sys.stderr,
)

print(
    f"[GMAIL MCP] Client secret loaded: {bool(GOOGLE_CLIENT_SECRET)}",
    file=sys.stderr,
)

print(
    f"[GMAIL MCP] PostgreSQL password loaded: "
    f"{bool(os.getenv('POSTGRES_PASSWORD'))}",
    file=sys.stderr,
)


# ============================================================
# MCP SERVER
# ============================================================

mcp = FastMCP("gmail")


# ============================================================
# LOAD GMAIL REFRESH TOKEN
# ============================================================

def load_refresh_token(user_id: str) -> str:
    """
    Load the Gmail refresh token for a user from PostgreSQL.
    """

    postgres_host = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port = os.getenv("POSTGRES_PORT", "5432")
    postgres_db = os.getenv("POSTGRES_DB")
    postgres_user = os.getenv("POSTGRES_USER")
    postgres_password = os.getenv("POSTGRES_PASSWORD")

    print(
        f"[GMAIL MCP] Connecting to PostgreSQL "
        f"host={postgres_host}, "
        f"port={postgres_port}, "
        f"database={postgres_db}, "
        f"user={postgres_user}",
        file=sys.stderr,
    )

    if not postgres_db:
        raise ValueError("POSTGRES_DB is not set in .env")

    if not postgres_user:
        raise ValueError("POSTGRES_USER is not set in .env")

    if not postgres_password:
        raise ValueError("POSTGRES_PASSWORD is not set in .env")

    conn = psycopg2.connect(
        host=postgres_host,
        port=postgres_port,
        database=postgres_db,
        user=postgres_user,
        password=postgres_password,
    )

    try:
        with conn.cursor() as cursor:

            cursor.execute(
                """
                SELECT refresh_token
                FROM gmail_credentials
                WHERE user_id = %s
                LIMIT 1
                """,
                (user_id,),
            )

            row = cursor.fetchone()

            if not row:
                raise ValueError(
                    f"No Gmail credentials found for user_id={user_id}"
                )

            refresh_token = row[0]

            if not refresh_token:
                raise ValueError(
                    f"Gmail refresh token is empty for user_id={user_id}"
                )

            print(
                f"[GMAIL MCP] Refresh token found for "
                f"user_id={user_id}",
                file=sys.stderr,
            )

            return refresh_token

    finally:
        conn.close()

# ============================================================
# GOOGLE CREDENTIALS
# ============================================================

def get_credentials_for_user(user_id: str) -> Credentials:
    """
    Create Gmail credentials for a specific user
    using the refresh token stored in PostgreSQL.
    """

    refresh_token = load_refresh_token(user_id)

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        token_uri=GOOGLE_TOKEN_URI,
    )

    print(
        f"[GMAIL MCP] Refreshing Google access token "
        f"for user_id={user_id}",
        file=sys.stderr,
    )

    # Exchange the refresh token for a fresh access token.
    creds.refresh(GoogleRequest())

    print(
        "[GMAIL MCP] Google access token refreshed successfully",
        file=sys.stderr,
    )

    return creds


# ============================================================
# SEND EMAIL TOOL
# ============================================================

@mcp.tool()
def send_email(
    user_id: str,
    to: str,
    subject: str,
    body: str,
) -> str:
    """
    Send an email using the Gmail account connected
    to the specified user_id.
    """

    print(
        "\n[GMAIL MCP] ===============================",
        file=sys.stderr,
    )

    print(
        f"[GMAIL MCP] send_email called",
        file=sys.stderr,
    )

    print(
        f"[GMAIL MCP] user_id: {user_id}",
        file=sys.stderr,
    )

    print(
        f"[GMAIL MCP] to: {to}",
        file=sys.stderr,
    )

    print(
        f"[GMAIL MCP] subject: {subject}",
        file=sys.stderr,
    )

    # Get authenticated Gmail credentials
    creds = get_credentials_for_user(user_id)

    # Build Gmail API client
    service = build(
        "gmail",
        "v1",
        credentials=creds,
    )

    # Build email
    message = MIMEText(body)

    message["To"] = to
    message["Subject"] = subject

    # Gmail API requires URL-safe base64
    raw = base64.urlsafe_b64encode(
        message.as_bytes()
    ).decode()

    # Send email
    result = (
        service
        .users()
        .messages()
        .send(
            userId="me",
            body={"raw": raw},
        )
        .execute()
    )

    message_id = result["id"]

    print(
        f"[GMAIL MCP] Email sent successfully!",
        file=sys.stderr,
    )

    print(
        f"[GMAIL MCP] Gmail message ID: {message_id}",
        file=sys.stderr,
    )

    print(
        "[GMAIL MCP] ===============================\n",
        file=sys.stderr,
    )

    return f"Email sent successfully, id: {message_id}"


# ============================================================
# START MCP SERVER
# ============================================================

if __name__ == "__main__":
    mcp.run(transport="stdio")

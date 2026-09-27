# Gig Scanner

An AI-powered pipeline (LangGraph + Groq) that scans freelance/job postings, scores them for fit, drafts pitches, and sends approved pitches by email via a Gmail MCP server.

## Prerequisites

* Python 3.11+
* Node.js 18+ and npm
* A Google account (for Gmail sending)
* API keys: [Tavily](https://tavily.com), [Groq](https://console.groq.com)
* A PostgreSQL database
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose (for the recommended setup below)
- A Google account (for Gmail sending)
- API keys: [Tavily](https://tavily.com), [Groq](https://console.groq.com)

## 1. Clone the repo

```bash
git clone https://github.com/Mohamed-Amine-Sassi/GigScanner.git
cd GigScanner
```

## 2. Configure environment variables

```bash
cp Backend/.env.example Backend/.env
```

Edit `Backend/.env` and fill in:

```dotenv
TAVILY_API_KEY=your_tavily_key_here
GROQ_API_KEY=your_groq_key_here
```

* **`TAVILY_API_KEY`** — get one free at https://tavily.com (used for scanning/searching job sources)
* **`GROQ_API_KEY`** — get one free at https://console.groq.com (used for scoring and drafting pitches via LLM)
* **`DATABASE_URL`** — your PostgreSQL database connection string
- **TAVILY_API_KEY** — get one free at https://tavily.com (used for scanning/searching job sources)
- **GROQ_API_KEY** — get one free at https://console.groq.com (used to draft pitches via LLM)

This file is gitignored — never commit it.

### Create the required database tables

Before running the backend, the PostgreSQL database specified by `DATABASE_URL` must contain the following **two tables**:

1. `gmail_credentials` — stores the Gmail account information and OAuth refresh token.
2. `seen_postings` — stores job postings that have already been processed so they are not repeatedly scanned.

You can create both tables with the following SQL:

```sql
CREATE TABLE IF NOT EXISTS gmail_credentials (
    user_id TEXT,
    email TEXT,
    refresh_token TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE TABLE IF NOT EXISTS seen_postings (
    key TEXT,
    first_seen_at TIMESTAMP WITHOUT TIME ZONE
);
```

The database structure should look approximately like this:

```text
gmail_credentials
├── user_id        TEXT
├── email          TEXT
├── refresh_token  TEXT
└── created_at     TIMESTAMP WITHOUT TIME ZONE

seen_postings
├── key            TEXT
└── first_seen_at  TIMESTAMP WITHOUT TIME ZONE
```

> **Important:** These tables are required for the application to work correctly. Make sure they are created in the same PostgreSQL database referenced by your `DATABASE_URL`.

You can execute the SQL using `psql`, pgAdmin, or another PostgreSQL client.

For example, with `psql`:

```bash
psql "your_database_connection_string_here"
```

Then paste the SQL above and execute it.
`DATABASE_URL` doesn't need to be set here — Docker Compose points the backend at its own Postgres container automatically. This file is gitignored — never commit it.

## 3. Gmail MCP server setup (required for sending emails)

The app sends approved pitches through a Gmail MCP server, which needs its own one-time Google OAuth setup. This step happens on your host machine (not inside a container) since it needs to open a browser.

### a. Create Google Cloud credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a new project
2. Enable the **Gmail API** for that project
3. Go to **APIs & Services → OAuth consent screen** → configure:

   * User type: External
   * Add scope: `.../auth/gmail.send`
   * Add your own Gmail address as a **test user**
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**

   * Application type: **Desktop app**
   * Download the resulting JSON

### b. Place and rename the credentials file

Rename the downloaded file to `gcp-oauth.keys.json` and place it in:

```text
Gmail-MCP-Server/gcp-oauth.keys.json
```

This file is gitignored — never commit it.

### c. Run the one-time auth flow

From the project root:

```bash
npx -y @gongrzhe/server-gmail-autoauth-mcp auth
```

This opens your browser for Google consent. Approve access — you'll see an "unverified app" warning since it's in testing mode; click **Advanced → Go to [app name] (unsafe)** to proceed.

This generates a token stored globally at:

```text
~/.gmail-mcp/credentials.json
```

The Gmail MCP server reads this token from then on, so you only need to complete the OAuth flow once per machine.
This opens your browser for Google consent. Approve access — you'll see an "unverified app" warning since it's in testing mode; click **Advanced → Go to [app name] (unsafe)** to proceed. This generates a token stored globally at `~/.gmail-mcp/credentials.json`. Docker Compose mounts this folder into the backend container automatically, so you only need to do this once per machine — the container reuses it.

## 4. Run the app

```bash
cd Frontend/gig-scanner-ui
npm install
```

## 5. Running the app

You'll need three terminals/processes running:

### Backend API

docker compose up --build
```

This starts three containers:

| Service | URL | What it does |
|---|---|---|
| `frontend` | http://localhost:5173 | React/Vite UI for reviewing and approving drafts |
| `backend` | http://localhost:8000 | FastAPI server the frontend talks to |
| `db` | localhost:5432 | Postgres — tables are created automatically on first start |

Open http://localhost:5173 in your browser once all three are up.

### Running the pipeline standalone

To trigger a scan/score/draft/send run directly, without going through the UI:

```bash
cd Backend
source .venv/bin/activate
uvicorn api:app --reload
```

### Frontend

```bash
cd Frontend/gig-scanner-ui
npm run dev
```

### Pipeline

Standalone pipeline execution is optional and can be used to test the scan/score/draft/send flow directly:

docker compose exec backend python runPipeline.py
```

### Stopping / resetting

```bash
docker compose down        # stop containers, keep data
docker compose down -v     # stop containers and wipe the Postgres volume
```

## About this project

This app was originally built for my own personal freelance job search — several files contain **my** profile, skills, and scoring criteria hardcoded in. If you clone this to search for gigs matching *your* profile instead, you'll need to edit:

* **`Backend/Nodes/DraftPitch.py`** — the `YOUR_PROFILE` variable at the top of the file. This text gets fed to the LLM as your background/skills when it drafts pitches, so replace it with your own experience, skills, and preferences.
* **`Backend/Nodes/Score.py`** — the scoring criteria used to judge how well a posting fits. This currently reflects my skill set and priorities (e.g. weighting AI/agent work over generic CRUD work) — update it to match what you're actually looking for.

Everything else (scanning sources, dedupe logic, the pipeline structure, the email-sending node) is generic and doesn't need changes to work for a different person's job search — only the profile and scoring criteria are personal.

## Notes

* The Gmail MCP server (`Gmail-MCP-Server/`) is spawned automatically as a subprocess by the backend when it needs to send email — you don't need to start it manually, just complete the one-time auth in step 3.
* Emails send from whichever Gmail account completed the OAuth flow in step 3 — there's currently no per-user sign-in; it's a single fixed sending account.
* The PostgreSQL database must contain both `gmail_credentials` and `seen_postings` before starting the application.
* The `gmail_credentials` table contains OAuth refresh tokens. Treat this data as sensitive and never commit, expose, or share your database contents.

- The Gmail MCP server package (`@gongrzhe/server-gmail-autoauth-mcp`) is spawned automatically as a subprocess by the backend when it needs to send email — you don't need to start it manually, just complete the one-time auth in step 3. The `Gmail-MCP-Server/` folder in this repo is a vendored reference copy of that package and isn't used directly by the app.
- Emails send from whichever Gmail account completed the OAuth flow in step 3 — there's currently no per-user sign-in; it's a single fixed sending account.
- Code changes to `Backend/` and `Frontend/gig-scanner-ui/` are picked up live — both are mounted into their containers, so you don't need to rebuild after every edit. Rebuild (`docker compose build`) only when you change `requirements.txt`, `package.json`, or a Dockerfile.
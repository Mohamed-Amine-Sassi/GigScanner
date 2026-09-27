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

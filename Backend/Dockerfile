FROM python:3.11-slim

# Node.js + npm are required because mcp_setup.py spawns the Gmail MCP
# server as a subprocess via `npx -y @gongrzhe/server-gmail-autoauth-mcp`.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-fetch the Gmail MCP server package into npx's cache so the first
# real run doesn't stall on a cold npm download.
RUN npx -y @gongrzhe/server-gmail-autoauth-mcp --version || true

COPY . .

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

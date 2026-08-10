from langchain_mcp_adapters.client import MultiServerMCPClient

mcp_client = MultiServerMCPClient(
    {
        "gmail": {
            "command": "python",
            "args": ["gmail_server.py"],
            "transport": "stdio",
        }
    }
)

async def get_send_email_tool():
    tools = await mcp_client.get_tools()
    return next(t for t in tools if t.name == "send_email")
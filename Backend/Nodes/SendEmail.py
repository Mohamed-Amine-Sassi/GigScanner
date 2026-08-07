from StateSchema import GigScannerState
from mcp_setup import get_send_email_tool


async def send_email_node(state: GigScannerState) -> GigScannerState:
    send_email_tool = await get_send_email_tool()

    approved = state.get("approved", [])
    send_results = []

    for draft in approved:
        contact = draft.get("contact", {})
        recipient = contact.get("value")

        if not recipient:
            send_results.append({"title": draft.get("title"), "status": "skipped: no email"})
            continue

        result = await send_email_tool.ainvoke({
            "to": [recipient],
            "subject": f"Re: {draft.get('title', 'your posting')}",
            "body": draft.get("pitch", ""),
        })
        send_results.append({"title": draft.get("title"), "result": result})

    return {**state, "send_results": send_results}
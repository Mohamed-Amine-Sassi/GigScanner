
from StateSchema import GigScannerState
from mcp_setup import get_send_email_tool


async def send_email_node(state: GigScannerState) -> GigScannerState:
    print("\n========== SEND EMAIL NODE ==========")

    send_email_tool = await get_send_email_tool()

    approved = state.get("approved", [])
    send_results = []

    print(f"Approved drafts: {len(approved)}")
    print(f"User ID: {state.get('user_id')}")

    for draft in approved:
        contact = draft.get("contact", {})
        recipient = contact.get("value")

        if not recipient:
            print("Skipping draft: no recipient")
            continue

        # Build the arguments that will be sent to the MCP tool
        email_data = {
            "user_id": state["user_id"],
            "to": recipient,
            "subject": f"Re: {draft.get('title', 'your posting')}",
            "body": draft.get("pitch", ""),
        }

        print("\nCalling MCP send_email:")
        print(f"  user_id: {email_data['user_id']}")
        print(f"  to: {email_data['to']}")
        print(f"  subject: {email_data['subject']}")

        try:
            # Call the MCP tool ONCE
            result = await send_email_tool.ainvoke(email_data)

            print("\nMCP send_email RESULT:")
            print(result)

            send_results.append(result)

        except Exception as e:
            print("\nMCP send_email ERROR:")
            print(repr(e))
            raise

    print("\n========== SEND EMAIL NODE FINISHED ==========")

    return {
        **state,
        "send_results": send_results,
    }


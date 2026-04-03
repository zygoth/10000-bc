import requests
import os
from dotenv import load_dotenv
import sys

# Load environment variables
load_dotenv()
DISCORD_WEBHOOK_URL = os.getenv('DISCORD_WEBHOOK_URL')

def send_notification(title, message, message_type="question"):
    """
    Send a notification to Discord
    
    Args:
        title (str): Short title/subject of the notification
        message (str): Main message content (supports Discord markdown)
        message_type (str): Type of notification - "question", "complete", "error", or "info"
    """
    
    if not DISCORD_WEBHOOK_URL:
        print("Error: DISCORD_WEBHOOK_URL not set in .env file")
        sys.exit(1)
    
    # Formatting prefixes for different message types
    prefixes = {
        "question": "❓ **QUESTION:**",
        "complete": "✅ **COMPLETE:**",
        "error": "❌ **ERROR:**",
        "info": "ℹ️ **INFO:**"
    }
    
    prefix = prefixes.get(message_type, "ℹ️ **INFO:**")
    
    # Format the full message with title and content
    full_message = f"{prefix} **{title}**\n\n{message}"
    
    payload = {
        "content": full_message
    }
    
    try:
        response = requests.post(DISCORD_WEBHOOK_URL, json=payload)
        response.raise_for_status()
        print(f"Notification sent successfully")
        return True
    except Exception as e:
        print(f"Error sending notification: {e}")
        return False

if __name__ == "__main__":
    # Allow script to be called from command line
    # Usage: python notify_discord.py "Title" "Message" "question"
    
    if len(sys.argv) < 3:
        print("Usage: python notify_discord.py <title> <message> [message_type]")
        print("message_type options: question, complete, error, info")
        sys.exit(1)
    
    title = sys.argv[1]
    message = sys.argv[2]
    msg_type = sys.argv[3] if len(sys.argv) > 3 else "info"
    
    send_notification(title, message, msg_type)
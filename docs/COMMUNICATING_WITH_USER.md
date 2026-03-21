# Windsurf Discord Integration Guide

This project uses a Discord integration that allows you to send notifications to the user and receive responses when you need input.

## How It Works

1. If the last message sent by the user included a reference to this file, then you should probably call the notification script as your reply & not reply as regular output. 
2. The user receives a notification on their phone and can reply in Discord at any time
3. Your notification listener automatically detects their response and inputs it back into Windsurf
4. You can then continue working with their response

Since the user can't see the code on their phone, you need to be very explicit about what you did when you make any code changes. Send more than one message if you need the extra space to explain.

## Setting up remote work sessions

If the user asks you to set up for remote work, you should:

1. Run the notification listener script (`python3 scripts/Windsurf_discord_integration/windsurf_discord_bot.py`)
2. Start the dev server bound to 0.0.0.0 using the batch file: `scripts/start_dev.bat`
3. Get the local IP address with `ipconfig | findstr "IPv4"` and send the URL (`http://<ip>:3000`) to the user via Discord

The user will connect to the dev server on the same WIFI via phone to test your changes during the development session. This allows the user to direct you from their phone and still be able to test the game.

## Using the Notification Script

The script is located at: `scripts/Windsurf_discord_integration/notify_discord.py`

### Basic Usage

```python
import subprocess

# When you need input on a decision
subprocess.run([
    'python', 'notify_discord.py',
    'Need Input: Database Schema',
    'Should we use PostgreSQL or MySQL? Current context: We need transactions and complex queries.',
    'question'
])

# When a task completes
subprocess.run([
    'python', 'notify_discord.py',
    'Task Complete: Unit Tests',
    'All 42 tests passed. Ready for next step.',
    'complete'
])

# When something goes wrong
subprocess.run([
    'python', 'notify_discord.py',
    'Error: Build Failed',
    'Compilation error in main.cpp line 45. Need review.',
    'error'
])
```

### Function Signature

```
notify_discord.py <title> <message> [message_type]
```

**Parameters:**
- `title` (required): Short subject line (what you're asking/reporting)
- `message` (required): Detailed message with context
- `message_type` (optional): One of `question`, `complete`, `error`, `info` (default: `info`)

### Message Types & Colors

- **question** (Blue): Use when you need user input or a decision
- **complete** (Green): Use when a task finishes successfully
- **error** (Red): Use when something fails and needs attention
- **info** (Gray): General information

## Receiving User Responses

When the user replies in Discord, the response is automatically typed into Windsurf and sent (Ctrl+Enter is pressed automatically).

**Important:** After calling the notification script, the user may take time to respond. You should:
1. Continue with other work if possible
2. Check back periodically for input
3. Handle the case where input might not arrive immediately

## Examples

### Example 1: Asking for Architecture Decision

```python
subprocess.run([
    'python', 'notify_discord.py',
    'Architecture Decision: API Design',
    'Should the API use REST or GraphQL? REST is simpler, GraphQL allows flexible queries. What\'s your preference?',
    'question'
])
```

### Example 2: Reporting Task Completion

```python
subprocess.run([
    'python', 'notify_discord.py',
    'Refactoring Complete',
    'Extracted common patterns into BaseController class. Tests all passing. Ready for code review.',
    'complete'
])
```

### Example 3: Critical Error Requiring Attention

```python
subprocess.run([
    'python', 'notify_discord.py',
    'Database Connection Failed',
    'Cannot connect to database at localhost:5432. Please check if the server is running.',
    'error'
])
```

## Best Practices

1. **Be specific in titles** - Make it clear what you're asking about at a glance
2. **Provide context** - Include relevant details in the message so the user can make informed decisions
3. **Use appropriate types** - Use `question` when waiting for input, `complete` for success, `error` for failures


## Troubleshooting

- If notification doesn't appear in Discord: Check that `notify_discord.py` is in the correct directory
- If you're not getting responses: Make sure the user's bot listener script is running
- For debugging: Add print statements after calling the notification script to confirm it executed
import discord
from discord.ext import commands
import pyautogui
import os
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')
CHANNEL_ID = int(os.getenv('CHANNEL_ID'))
USER_ID = int(os.getenv('USER_ID'))  # Your Discord user ID

# Setup bot with intents
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

@bot.event
async def on_ready():
    print(f'{bot.user} has connected to Discord!')
    print(f'Listening on channel ID: {CHANNEL_ID}')
    print(f'Will respond to messages from user ID: {USER_ID}')

@bot.event
async def on_message(message):
    # Ignore messages from the bot itself
    if message.author == bot.user:
        return
    
    # Only respond to messages in our designated channel
    if message.channel.id != CHANNEL_ID:
        return
    
    # Only respond to messages from you (the user)
    if message.author.id != USER_ID:
        return
    
    # Ignore empty messages
    if not message.content.strip():
        return
    
    print(f'Message received from {message.author}: {message.content}')
    
    # Extract the response text
    response_text = '@docs/COMMUNICATING_WITH_USER.md ' + message.content
    
    # Type the response into Windsurf
    type_response(response_text)
    
    # React with checkmark to show we processed it
    await message.add_reaction('✅')

def type_response(text):
    """Type text into the active window and press Ctrl+Enter"""
    try:
        # Small delay to ensure window is focused
        time.sleep(0.5)
        
        # Type the text character by character with small delays
        # This is more reliable than paste for some applications
        for char in text:
            pyautogui.typewrite(char, interval=0.001)
        
        # Alternative: use paste (faster but may not work in all cases)
        # Uncomment below and comment out the loop above if typewrite doesn't work
        # import subprocess
        # subprocess.run(['clip'], input=text.encode(), check=True)  # Windows only
        # pyautogui.hotkey('ctrl', 'v')
        
        # Small delay before sending
        time.sleep(0.3)
        
        # Press Ctrl+Enter to send
        pyautogui.hotkey('ctrl', 'return')
        
        print(f'Response typed and sent')
        
    except Exception as e:
        print(f'Error typing response: {e}')

# Run the bot
if __name__ == '__main__':
    bot.run(DISCORD_TOKEN)
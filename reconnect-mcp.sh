#!/bin/bash
# Script to reconnect all MCP servers in Claude Code
# Since there's no built-in command, this automates the process

echo "🔄 Reconnecting all MCP servers..."

# List of your MCP servers
servers=(
  "context7"
  "magic"
  "playwright"
  "sequential-thinking"
)

# Function to send reconnect command to Claude
reconnect_server() {
  echo "Reconnecting $1..."
  # This would need to interact with Claude's UI
  # Currently, manual intervention is required
  echo "/mcp" | pbcopy
  echo "Command '/mcp' copied to clipboard for server: $1"
  echo "Please paste in Claude Code and press Enter"
  read -p "Press Enter when done..."
}

# Alternative: Kill and restart Claude Desktop (most reliable method)
echo "Alternative method: Restarting Claude Desktop..."
echo "This will close and reopen Claude to reconnect all MCP servers"
read -p "Press Enter to restart Claude Desktop, or Ctrl+C to cancel..."

# Kill Claude Desktop
osascript -e 'quit app "Claude"'
sleep 2

# Reopen Claude Desktop
open -a "Claude"

echo "✅ Claude Desktop restarted - all MCP servers should be reconnected"
echo ""
echo "Tip: Check connection status with /mcp command in Claude Code"
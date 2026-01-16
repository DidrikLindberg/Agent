# Email Agent

A personal assistant agent that summarizes your Gmail inbox and lets you manage emails through natural language commands.

## Features

- **Daily Email Summaries**: Automatically fetches and summarizes your unread emails using Claude AI
- **Actionable Insights**: Prioritizes emails requiring attention with clear action items
- **Natural Language Commands**: Reply to summary emails with commands like:
  - "Reply to EMAIL-001: I'll be there at 2pm"
  - "Archive EMAIL-003"
  - "Forward EMAIL-002 to john@example.com"
- **Scheduled Execution**: Runs automatically via Windows Task Scheduler

## Tech Stack

- TypeScript / Node.js
- Gmail API (OAuth2)
- Claude API (Anthropic)
- Windows Task Scheduler

## Setup

### Prerequisites

- Node.js 18+
- A Google Cloud Project with Gmail API enabled
- An Anthropic API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/DidrikLindberg/Agent.git
   cd Agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with your credentials (see Configuration section)

5. Run the OAuth setup to authenticate with Gmail:
   ```bash
   npm run setup-oauth
   ```

6. Test the agent:
   ```bash
   npm run dev
   ```

### Configuration

#### Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Gmail API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Select "Desktop app" as the application type
6. Copy the Client ID and Client Secret to your `.env` file

#### Anthropic Setup

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Add it to your `.env` file

### Scheduling (Windows)

To run the agent daily at 8:00 AM:

```powershell
$action = New-ScheduledTaskAction -Execute "node" `
  -Argument "C:\path\to\Agent\dist\scripts\run-agent.js" `
  -WorkingDirectory "C:\path\to\Agent"

$trigger = New-ScheduledTaskTrigger -Daily -At 8:00AM

Register-ScheduledTask -TaskName "EmailAgentDailySummary" `
  -Action $action -Trigger $trigger
```

## Usage

### Daily Summary

The agent sends you an email like:

```
Subject: Daily Email Summary - January 15, 2026

## Today's Summary
You have 12 unread emails. Here are the highlights:

### Action Required
1. [EMAIL-001] Meeting request from boss@company.com
   → Schedule meeting for project review

### Informational
- Newsletter from tech-news@example.com

## How to Respond
Reply to this email with commands like:
- "Reply to EMAIL-001: I'm available at 2pm tomorrow"
- "Archive EMAIL-003"
```

### Commands

| Command | Example |
|---------|---------|
| Reply | `Reply to EMAIL-001: Thanks, I'll be there` |
| Forward | `Forward EMAIL-002 to john@example.com` |
| Archive | `Archive EMAIL-003` |
| Delete | `Delete EMAIL-004` |
| Mark Read | `Mark EMAIL-005 as read` |
| Star | `Star EMAIL-006` |

## Development

```bash
# Run in development mode
npm run dev

# Type check
npm run typecheck

# Run tests
npm test

# Build for production
npm run build
```

## License

MIT

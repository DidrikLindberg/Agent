import type { ClaudeClient } from './ClaudeClient.js';
import type { Command, CommandType } from '../../models/Command.js';
import type { Logger } from 'winston';

interface ParsedCommand {
  type: CommandType;
  targetRef: string;
  content?: string;
  forwardTo?: string;
  note?: string;
  labelName?: string;
}

interface ParseResponse {
  commands: ParsedCommand[];
  unrecognized: string[];
}

const SYSTEM_PROMPT = `You are a command parser for an email assistant.
Your job is to extract structured commands from natural language user input.

Available commands:
- reply: Reply to an email. Requires target reference and reply content.
- forward: Forward an email. Requires target reference, recipient email, and optional note.
- archive: Archive an email. Requires target reference.
- delete: Delete an email. Requires target reference.
- mark_read: Mark email as read. Requires target reference.
- mark_unread: Mark email as unread. Requires target reference.
- star: Star an email. Requires target reference.
- unstar: Remove star from email. Requires target reference.
- label: Add a label to an email. Requires target reference and label name.

Email references use the format EMAIL-XXX (e.g., EMAIL-001, EMAIL-015).

Parse the user's input and extract all valid commands. If something cannot be parsed as a command, add it to the "unrecognized" array.

Always respond with valid JSON.`;

export class CommandParser {
  constructor(
    private claude: ClaudeClient,
    private logger?: Logger
  ) {}

  async parseCommands(userInput: string, summaryContext?: string): Promise<{ commands: Command[]; unrecognized: string[] }> {
    this.logger?.info('Parsing commands from user input');

    const prompt = this.buildParsePrompt(userInput, summaryContext);
    const response = await this.claude.parseJson<ParseResponse>(prompt);

    const commands = this.transformCommands(response.commands);

    this.logger?.info(`Parsed ${commands.length} commands, ${response.unrecognized.length} unrecognized`);

    return {
      commands,
      unrecognized: response.unrecognized,
    };
  }

  private buildParsePrompt(userInput: string, summaryContext?: string): string {
    let prompt = `${SYSTEM_PROMPT}

User input to parse:
"""
${userInput}
"""
`;

    if (summaryContext) {
      prompt += `
Context from the summary email (for reference):
${summaryContext}
`;
    }

    prompt += `
Respond with JSON in this exact format:
{
  "commands": [
    {
      "type": "reply",
      "targetRef": "EMAIL-001",
      "content": "The reply message content"
    },
    {
      "type": "forward",
      "targetRef": "EMAIL-002",
      "forwardTo": "recipient@example.com",
      "note": "Optional note to include"
    },
    {
      "type": "archive",
      "targetRef": "EMAIL-003"
    },
    {
      "type": "label",
      "targetRef": "EMAIL-004",
      "labelName": "Important"
    }
  ],
  "unrecognized": [
    "Any text that couldn't be parsed as a command"
  ]
}`;

    return prompt;
  }

  private transformCommands(parsed: ParsedCommand[]): Command[] {
    return parsed.map((p) => {
      const base = {
        targetRef: p.targetRef,
      };

      switch (p.type) {
        case 'reply':
          return {
            ...base,
            type: 'reply' as const,
            content: p.content || '',
          };
        case 'forward':
          return {
            ...base,
            type: 'forward' as const,
            forwardTo: p.forwardTo || '',
            note: p.note,
          };
        case 'archive':
          return { ...base, type: 'archive' as const };
        case 'delete':
          return { ...base, type: 'delete' as const };
        case 'mark_read':
          return { ...base, type: 'mark_read' as const };
        case 'mark_unread':
          return { ...base, type: 'mark_unread' as const };
        case 'star':
          return { ...base, type: 'star' as const };
        case 'unstar':
          return { ...base, type: 'unstar' as const };
        case 'label':
          return {
            ...base,
            type: 'label' as const,
            labelName: p.labelName || '',
          };
        default:
          throw new Error(`Unknown command type: ${p.type}`);
      }
    });
  }
}

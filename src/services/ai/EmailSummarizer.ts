import { v4 as uuidv4 } from 'uuid';
import type { ClaudeClient } from './ClaudeClient.js';
import type { Email } from '../../models/Email.js';
import type { Summary, ActionItem, InformationalItem } from '../../models/Summary.js';
import type { Logger } from 'winston';

interface SummaryResponse {
  executiveSummary: string;
  actionItems: Array<{
    referenceId: string;
    priority: 'high' | 'medium' | 'low';
    description: string;
    suggestedAction: string;
  }>;
  informational: Array<{
    referenceId: string;
    description: string;
  }>;
}

const SYSTEM_PROMPT = `You are an intelligent email assistant helping a busy professional manage their inbox efficiently.
Your task is to analyze emails and provide actionable summaries.

Guidelines:
- Be concise but informative
- Prioritize emails requiring immediate action
- Identify key deadlines and meetings
- Group related emails when relevant
- Ignore obvious spam or promotional emails unless specifically relevant
- For action items, provide clear, specific suggested actions

Always respond with valid JSON matching the specified format.`;

export class EmailSummarizer {
  constructor(
    private claude: ClaudeClient,
    private logger?: Logger
  ) {}

  async summarize(emails: Email[]): Promise<Summary> {
    if (emails.length === 0) {
      return this.createEmptySummary();
    }

    this.logger?.info(`Summarizing ${emails.length} emails`);

    const prompt = this.buildSummaryPrompt(emails);
    const response = await this.claude.parseJson<SummaryResponse>(prompt);

    return this.createSummary(emails, response);
  }

  private buildSummaryPrompt(emails: Email[]): string {
    const emailList = emails
      .map((email) => {
        const body = email.body.plain.slice(0, 1000); // Limit body length
        return `
[${email.referenceId}]
From: ${email.from.name ? `${email.from.name} <${email.from.address}>` : email.from.address}
Subject: ${email.subject}
Date: ${email.date.toISOString()}
Preview: ${email.snippet}
${body ? `Body excerpt:\n${body}${body.length >= 1000 ? '...' : ''}` : ''}
---`;
      })
      .join('\n');

    return `${SYSTEM_PROMPT}

Analyze these ${emails.length} emails and provide a structured summary.

For each email that requires action, create an action item with:
- referenceId: The email's ID (e.g., EMAIL-001)
- priority: "high" (urgent/deadline), "medium" (important but not urgent), or "low" (can wait)
- description: Brief description of what the email is about
- suggestedAction: Specific action the user should take

For informational emails (newsletters, notifications, etc.), create an informational item with:
- referenceId: The email's ID
- description: Brief description of the content

Emails to analyze:
${emailList}

Respond with JSON in this exact format:
{
  "executiveSummary": "A 2-3 sentence overview of the inbox state and most important items",
  "actionItems": [
    {
      "referenceId": "EMAIL-001",
      "priority": "high",
      "description": "Meeting request from John",
      "suggestedAction": "Confirm attendance for tomorrow at 2pm"
    }
  ],
  "informational": [
    {
      "referenceId": "EMAIL-005",
      "description": "Weekly newsletter from Tech News"
    }
  ]
}`;
  }

  private createSummary(emails: Email[], response: SummaryResponse): Summary {
    const emailMappings = new Map<string, string>();
    for (const email of emails) {
      emailMappings.set(email.referenceId, email.id);
    }

    const actionItems: ActionItem[] = response.actionItems.map((item) => {
      const email = emails.find((e) => e.referenceId === item.referenceId);
      return {
        referenceId: item.referenceId,
        priority: item.priority,
        description: item.description,
        suggestedAction: item.suggestedAction,
        fromEmail: email?.from.address || '',
        subject: email?.subject || '',
      };
    });

    const informational: InformationalItem[] = response.informational.map((item) => {
      const email = emails.find((e) => e.referenceId === item.referenceId);
      return {
        referenceId: item.referenceId,
        description: item.description,
        fromEmail: email?.from.address || '',
      };
    });

    const now = new Date();
    const unreadCount = emails.filter((e) => e.isUnread).length;

    return {
      id: uuidv4(),
      generatedAt: now,
      periodStart: new Date(Math.min(...emails.map((e) => e.date.getTime()))),
      periodEnd: now,
      totalEmails: emails.length,
      unreadCount,
      executiveSummary: response.executiveSummary,
      actionItems,
      informational,
      emailMappings,
    };
  }

  private createEmptySummary(): Summary {
    const now = new Date();
    return {
      id: uuidv4(),
      generatedAt: now,
      periodStart: now,
      periodEnd: now,
      totalEmails: 0,
      unreadCount: 0,
      executiveSummary: 'No new emails to summarize.',
      actionItems: [],
      informational: [],
      emailMappings: new Map(),
    };
  }
}

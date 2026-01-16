import type { Email } from './Email.js';

export type Priority = 'high' | 'medium' | 'low';

export interface ActionItem {
  referenceId: string;
  priority: Priority;
  description: string;
  suggestedAction: string;
  fromEmail: string;
  subject: string;
}

export interface InformationalItem {
  referenceId: string;
  description: string;
  fromEmail: string;
}

export interface Summary {
  id: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  totalEmails: number;
  unreadCount: number;
  executiveSummary: string;
  actionItems: ActionItem[];
  informational: InformationalItem[];
  emailMappings: Map<string, string>; // EMAIL-XXX → Gmail ID
}

export interface SummaryEmailData {
  date: string;
  totalEmails: number;
  unreadCount: number;
  executiveSummary: string;
  actionItems: ActionItem[];
  informational: InformationalItem[];
  commandExamples: string[];
}

export interface StoredSummary {
  id: string;
  generatedAt: string;
  emailMappings: Record<string, string>;
  threadId?: string;
  messageId?: string;
}

export function summaryToStorable(summary: Summary, threadId?: string, messageId?: string): StoredSummary {
  return {
    id: summary.id,
    generatedAt: summary.generatedAt.toISOString(),
    emailMappings: Object.fromEntries(summary.emailMappings),
    threadId,
    messageId,
  };
}

export function loadStoredSummary(stored: StoredSummary): { emailMappings: Map<string, string>; threadId?: string; messageId?: string } {
  return {
    emailMappings: new Map(Object.entries(stored.emailMappings)),
    threadId: stored.threadId,
    messageId: stored.messageId,
  };
}

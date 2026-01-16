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
  const result: StoredSummary = {
    id: summary.id,
    generatedAt: summary.generatedAt.toISOString(),
    emailMappings: Object.fromEntries(summary.emailMappings),
  };
  if (threadId !== undefined) result.threadId = threadId;
  if (messageId !== undefined) result.messageId = messageId;
  return result;
}

export function loadStoredSummary(stored: StoredSummary): { emailMappings: Map<string, string>; threadId?: string; messageId?: string } {
  const result: { emailMappings: Map<string, string>; threadId?: string; messageId?: string } = {
    emailMappings: new Map(Object.entries(stored.emailMappings)),
  };
  if (stored.threadId !== undefined) result.threadId = stored.threadId;
  if (stored.messageId !== undefined) result.messageId = stored.messageId;
  return result;
}

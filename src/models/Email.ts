export interface EmailAddress {
  name: string;
  address: string;
}

export interface Attachment {
  filename: string;
  mimeType: string;
  size: number;
}

export interface Email {
  id: string;
  threadId: string;
  referenceId: string; // Short reference like EMAIL-001
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  subject: string;
  snippet: string;
  body: {
    plain: string;
    html?: string;
  };
  date: Date;
  labels: string[];
  attachments: Attachment[];
  isUnread: boolean;
}

export interface EmailThread {
  id: string;
  messages: Email[];
  subject: string;
  participants: EmailAddress[];
}

export function formatEmailAddress(addr: EmailAddress): string {
  if (addr.name) {
    return `${addr.name} <${addr.address}>`;
  }
  return addr.address;
}

export function parseEmailAddress(raw: string): EmailAddress {
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || '',
      address: match[2]?.trim() || raw,
    };
  }
  return { name: '', address: raw };
}

export function generateReferenceId(index: number): string {
  return `EMAIL-${String(index + 1).padStart(3, '0')}`;
}

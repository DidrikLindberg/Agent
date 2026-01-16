import { google, gmail_v1 } from 'googleapis';
import type { GmailAuth } from './GmailAuth.js';
import type { Config } from '../../config/index.js';
import type { Email, EmailAddress, Attachment } from '../../models/Email.js';
import { parseEmailAddress, generateReferenceId } from '../../models/Email.js';
import { parseDate } from '../../utils/dateUtils.js';

export class GmailClient {
  private gmail: gmail_v1.Gmail;

  constructor(auth: GmailAuth, private config: Config) {
    this.gmail = google.gmail({ version: 'v1', auth: auth.getClient() });
  }

  async listRecentEmails(hoursBack: number = 24): Promise<Email[]> {
    const query = `newer_than:${hoursBack}h`;

    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: this.config.agent.maxEmailsPerRun,
    });

    const messages = response.data.messages || [];
    const emails: Email[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg?.id) {
        const email = await this.getEmail(msg.id, i);
        emails.push(email);
      }
    }

    return emails;
  }

  async listUnreadEmails(): Promise<Email[]> {
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: this.config.agent.maxEmailsPerRun,
    });

    const messages = response.data.messages || [];
    const emails: Email[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg?.id) {
        const email = await this.getEmail(msg.id, i);
        emails.push(email);
      }
    }

    return emails;
  }

  async getEmail(messageId: string, index: number = 0): Promise<Email> {
    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    return this.parseMessage(response.data, index);
  }

  async sendEmail(to: string, subject: string, htmlBody: string, plainBody?: string): Promise<string> {
    const boundary = `boundary_${Date.now()}`;

    const messageParts = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      plainBody || this.htmlToPlainText(htmlBody),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      htmlBody,
      '',
      `--${boundary}--`,
    ];

    const message = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(message).toString('base64url');

    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return response.data.id || '';
  }

  async replyToEmail(
    originalMessageId: string,
    threadId: string,
    to: string,
    subject: string,
    htmlBody: string,
    plainBody?: string
  ): Promise<string> {
    // Get the original message to extract Message-ID header
    const original = await this.gmail.users.messages.get({
      userId: 'me',
      id: originalMessageId,
      format: 'metadata',
      metadataHeaders: ['Message-ID'],
    });

    const messageIdHeader = original.data.payload?.headers?.find(
      (h) => h.name?.toLowerCase() === 'message-id'
    );
    const originalMessageIdValue = messageIdHeader?.value || '';

    const boundary = `boundary_${Date.now()}`;

    const messageParts = [
      `To: ${to}`,
      `Subject: ${subject.startsWith('Re:') ? subject : `Re: ${subject}`}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ...(originalMessageIdValue ? [`In-Reply-To: ${originalMessageIdValue}`, `References: ${originalMessageIdValue}`] : []),
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      plainBody || this.htmlToPlainText(htmlBody),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      htmlBody,
      '',
      `--${boundary}--`,
    ];

    const message = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(message).toString('base64url');

    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId,
      },
    });

    return response.data.id || '';
  }

  async archiveEmail(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['INBOX'],
      },
    });
  }

  async deleteEmail(messageId: string): Promise<void> {
    await this.gmail.users.messages.trash({
      userId: 'me',
      id: messageId,
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  async markAsUnread(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: ['UNREAD'],
      },
    });
  }

  async starEmail(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: ['STARRED'],
      },
    });
  }

  async unstarEmail(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['STARRED'],
      },
    });
  }

  async addLabel(messageId: string, labelName: string): Promise<void> {
    // First, try to find the label
    const labelsResponse = await this.gmail.users.labels.list({ userId: 'me' });
    const labels = labelsResponse.data.labels || [];
    let label = labels.find((l) => l.name?.toLowerCase() === labelName.toLowerCase());

    // Create label if it doesn't exist
    if (!label) {
      const createResponse = await this.gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });
      label = createResponse.data;
    }

    if (label?.id) {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [label.id],
        },
      });
    }
  }

  async searchReplies(subject: string, afterDate: Date): Promise<gmail_v1.Schema$Message[]> {
    const query = `in:sent subject:"Re: ${subject}" after:${Math.floor(afterDate.getTime() / 1000)}`;

    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 10,
    });

    return response.data.messages || [];
  }

  async getMessageContent(messageId: string): Promise<string> {
    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    return this.extractBody(response.data.payload).plain;
  }

  private parseMessage(message: gmail_v1.Schema$Message, index: number): Email {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string): string => {
      const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const from = parseEmailAddress(getHeader('From'));
    const toRaw = getHeader('To');
    const ccRaw = getHeader('Cc');

    const to: EmailAddress[] = toRaw
      .split(',')
      .map((addr) => parseEmailAddress(addr.trim()))
      .filter((addr) => addr.address);

    const cc: EmailAddress[] = ccRaw
      ? ccRaw
          .split(',')
          .map((addr) => parseEmailAddress(addr.trim()))
          .filter((addr) => addr.address)
      : [];

    const body = this.extractBody(message.payload);
    const attachments = this.extractAttachments(message.payload);
    const labels = message.labelIds || [];

    const email: Email = {
      id: message.id || '',
      threadId: message.threadId || '',
      referenceId: generateReferenceId(index),
      from,
      to,
      subject: getHeader('Subject'),
      snippet: message.snippet || '',
      body,
      date: parseDate(getHeader('Date')),
      labels,
      attachments,
      isUnread: labels.includes('UNREAD'),
    };
    if (cc.length > 0) email.cc = cc;
    return email;
  }

  private extractBody(payload?: gmail_v1.Schema$MessagePart): { plain: string; html?: string } {
    let plain = '';
    let html: string | undefined;

    const extractFromPart = (part: gmail_v1.Schema$MessagePart): void => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        plain = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }

      if (part.parts) {
        for (const subPart of part.parts) {
          extractFromPart(subPart);
        }
      }
    };

    if (payload) {
      // Check if the body is directly in the payload
      if (payload.body?.data) {
        const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        if (payload.mimeType === 'text/html') {
          html = decoded;
        } else {
          plain = decoded;
        }
      }

      // Check parts for multipart messages
      if (payload.parts) {
        for (const part of payload.parts) {
          extractFromPart(part);
        }
      }
    }

    const result: { plain: string; html?: string } = { plain };
    if (html !== undefined) result.html = html;
    return result;
  }

  private extractAttachments(payload?: gmail_v1.Schema$MessagePart): Attachment[] {
    const attachments: Attachment[] = [];

    const extractFromPart = (part: gmail_v1.Schema$MessagePart): void => {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
        });
      }

      if (part.parts) {
        for (const subPart of part.parts) {
          extractFromPart(subPart);
        }
      }
    };

    if (payload?.parts) {
      for (const part of payload.parts) {
        extractFromPart(part);
      }
    }

    return attachments;
  }

  private htmlToPlainText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

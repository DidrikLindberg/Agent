import fs from 'fs/promises';
import path from 'path';
import type { GmailClient } from '../services/gmail/GmailClient.js';
import type { EmailSummarizer } from '../services/ai/EmailSummarizer.js';
import type { Config } from '../config/index.js';
import type { Summary, StoredSummary } from '../models/Summary.js';
import { summaryToStorable } from '../models/Summary.js';
import { formatDate, getSummaryFileName } from '../utils/dateUtils.js';
import type { Logger } from 'winston';

export class SummaryHandler {
  constructor(
    private gmail: GmailClient,
    private summarizer: EmailSummarizer,
    private config: Config,
    private logger: Logger
  ) {}

  async generateAndSendSummary(): Promise<{ summary: Summary; messageId: string } | null> {
    this.logger.info('Starting summary generation');

    // Fetch recent emails
    const emails = await this.gmail.listRecentEmails(this.config.agent.emailLookbackHours);
    this.logger.info(`Fetched ${emails.length} emails from the last ${this.config.agent.emailLookbackHours} hours`);

    if (emails.length === 0) {
      this.logger.info('No emails to summarize');
      return null;
    }

    // Generate summary using Claude
    const summary = await this.summarizer.summarize(emails);
    this.logger.info(`Generated summary with ${summary.actionItems.length} action items`);

    if (this.config.agent.dryRun) {
      this.logger.info('Dry run mode - not sending email');
      console.log('\n=== SUMMARY PREVIEW ===\n');
      console.log(this.formatSummaryEmailHtml(summary));
      return { summary, messageId: 'dry-run' };
    }

    // Send summary email
    const subject = `Daily Email Summary - ${formatDate(new Date())}`;
    const htmlBody = this.formatSummaryEmailHtml(summary);
    const plainBody = this.formatSummaryEmailPlain(summary);

    const messageId = await this.gmail.sendEmail(
      this.config.user.email,
      subject,
      htmlBody,
      plainBody
    );

    this.logger.info(`Sent summary email with ID: ${messageId}`);

    // Store summary for command processing
    await this.storeSummary(summary, messageId);

    return { summary, messageId };
  }

  private formatSummaryEmailHtml(summary: Summary): string {
    const actionItemsHtml = summary.actionItems.length > 0
      ? summary.actionItems
          .map((item) => {
            const priorityColor = item.priority === 'high' ? '#dc3545' : item.priority === 'medium' ? '#ffc107' : '#28a745';
            return `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">
                <strong style="color: ${priorityColor};">[${item.referenceId}]</strong>
                <span style="color: #666; font-size: 12px; margin-left: 8px;">${item.priority.toUpperCase()}</span>
                <br/>
                <span style="color: #333;">${item.description}</span>
                <br/>
                <span style="color: #666; font-size: 13px;">From: ${item.fromEmail}</span>
                <br/>
                <span style="color: #0066cc; font-size: 13px;">→ ${item.suggestedAction}</span>
              </td>
            </tr>`;
          })
          .join('')
      : '<tr><td style="padding: 12px; color: #666;">No action items</td></tr>';

    const informationalHtml = summary.informational.length > 0
      ? summary.informational
          .map((item) => `
            <li style="margin-bottom: 8px; color: #666;">
              <strong>[${item.referenceId}]</strong> ${item.description}
              <br/>
              <span style="font-size: 12px;">From: ${item.fromEmail}</span>
            </li>`)
          .join('')
      : '<li style="color: #666;">No informational emails</li>';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">

  <h1 style="color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px;">
    📧 Daily Email Summary
  </h1>

  <p style="font-size: 14px; color: #666;">
    ${formatDate(new Date())} • ${summary.totalEmails} emails (${summary.unreadCount} unread)
  </p>

  <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #333;">Executive Summary</h3>
    <p style="margin-bottom: 0; color: #555;">${summary.executiveSummary}</p>
  </div>

  <h2 style="color: #dc3545;">⚡ Action Required</h2>
  <table style="width: 100%; border-collapse: collapse;">
    ${actionItemsHtml}
  </table>

  <h2 style="color: #28a745; margin-top: 30px;">📌 Informational</h2>
  <ul style="padding-left: 20px;">
    ${informationalHtml}
  </ul>

  <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin-top: 30px;">
    <h3 style="margin-top: 0; color: #0066cc;">💡 How to Respond</h3>
    <p style="margin-bottom: 10px;">Reply to this email with commands like:</p>
    <ul style="margin: 0; padding-left: 20px;">
      <li><code>Reply to EMAIL-001: I'll be available at 2pm tomorrow</code></li>
      <li><code>Archive EMAIL-003</code></li>
      <li><code>Forward EMAIL-002 to john@example.com</code></li>
      <li><code>Star EMAIL-004</code></li>
      <li><code>Mark EMAIL-005 as read</code></li>
    </ul>
  </div>

  <p style="font-size: 12px; color: #999; margin-top: 30px; text-align: center;">
    Generated by Email Agent • Summary ID: ${summary.id}
  </p>

</body>
</html>`;
  }

  private formatSummaryEmailPlain(summary: Summary): string {
    const actionItems = summary.actionItems.length > 0
      ? summary.actionItems
          .map((item) => `[${item.referenceId}] (${item.priority.toUpperCase()})\n  ${item.description}\n  From: ${item.fromEmail}\n  → ${item.suggestedAction}`)
          .join('\n\n')
      : 'No action items';

    const informational = summary.informational.length > 0
      ? summary.informational
          .map((item) => `• [${item.referenceId}] ${item.description} (from: ${item.fromEmail})`)
          .join('\n')
      : 'No informational emails';

    return `
DAILY EMAIL SUMMARY
${formatDate(new Date())} • ${summary.totalEmails} emails (${summary.unreadCount} unread)

EXECUTIVE SUMMARY
${summary.executiveSummary}

ACTION REQUIRED
${actionItems}

INFORMATIONAL
${informational}

HOW TO RESPOND
Reply to this email with commands like:
- Reply to EMAIL-001: I'll be available at 2pm tomorrow
- Archive EMAIL-003
- Forward EMAIL-002 to john@example.com
- Star EMAIL-004
- Mark EMAIL-005 as read

---
Generated by Email Agent • Summary ID: ${summary.id}
`.trim();
  }

  private async storeSummary(summary: Summary, messageId: string): Promise<void> {
    const summaryDir = this.config.paths.summaryStorage;
    await fs.mkdir(summaryDir, { recursive: true });

    const filename = getSummaryFileName();
    const filepath = path.join(summaryDir, filename);

    const storable = summaryToStorable(summary, undefined, messageId);
    await fs.writeFile(filepath, JSON.stringify(storable, null, 2));

    this.logger.info(`Stored summary to ${filepath}`);
  }

  async loadLatestSummary(): Promise<StoredSummary | null> {
    const summaryDir = this.config.paths.summaryStorage;

    try {
      const files = await fs.readdir(summaryDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse();

      if (jsonFiles.length === 0) {
        return null;
      }

      const latestFile = path.join(summaryDir, jsonFiles[0]!);
      const content = await fs.readFile(latestFile, 'utf-8');
      return JSON.parse(content) as StoredSummary;
    } catch {
      return null;
    }
  }
}

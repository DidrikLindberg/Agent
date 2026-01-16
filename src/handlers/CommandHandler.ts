import type { GmailClient } from '../services/gmail/GmailClient.js';
import type { CommandParser } from '../services/ai/CommandParser.js';
import type { SummaryHandler } from './SummaryHandler.js';
import type { Config } from '../config/index.js';
import type { Command, CommandResult } from '../models/Command.js';
import { loadStoredSummary } from '../models/Summary.js';
import { commandTypeToLabel } from '../models/Command.js';
import { formatDate } from '../utils/dateUtils.js';
import type { Logger } from 'winston';

export class CommandHandler {
  constructor(
    private gmail: GmailClient,
    private parser: CommandParser,
    private summaryHandler: SummaryHandler,
    private config: Config,
    private logger: Logger
  ) {}

  async processReplyCommands(): Promise<CommandResult[]> {
    this.logger.info('Checking for reply commands');

    // Load the latest summary to get email mappings
    const storedSummary = await this.summaryHandler.loadLatestSummary();
    if (!storedSummary) {
      this.logger.info('No summary found - nothing to process');
      return [];
    }

    const { emailMappings } = loadStoredSummary(storedSummary);

    // Search for replies to summary emails
    const summaryDate = new Date(storedSummary.generatedAt);
    const replies = await this.gmail.searchReplies('Daily Email Summary', summaryDate);

    if (replies.length === 0) {
      this.logger.info('No reply commands found');
      return [];
    }

    this.logger.info(`Found ${replies.length} potential reply commands`);

    const allResults: CommandResult[] = [];

    for (const reply of replies) {
      if (!reply.id) continue;

      const content = await this.gmail.getMessageContent(reply.id);
      if (!content.trim()) continue;

      // Parse commands from the reply
      const { commands, unrecognized } = await this.parser.parseCommands(content);

      if (unrecognized.length > 0) {
        this.logger.warn('Unrecognized commands', { unrecognized });
      }

      // Resolve email references to Gmail IDs
      const resolvedCommands = commands.map((cmd) => ({
        ...cmd,
        targetGmailId: emailMappings.get(cmd.targetRef),
      }));

      // Execute commands
      const results = await this.executeCommands(resolvedCommands);
      allResults.push(...results);
    }

    // Send confirmation email if we processed any commands
    if (allResults.length > 0 && !this.config.agent.dryRun) {
      await this.sendConfirmationEmail(allResults);
    }

    return allResults;
  }

  private async executeCommands(commands: Command[]): Promise<CommandResult[]> {
    const results: CommandResult[] = [];

    for (const command of commands) {
      const result = await this.executeCommand(command);
      results.push(result);
    }

    return results;
  }

  private async executeCommand(command: Command): Promise<CommandResult> {
    const gmailId = command.targetGmailId;

    if (!gmailId) {
      return {
        command,
        success: false,
        error: `Could not resolve ${command.targetRef} to a Gmail message ID`,
      };
    }

    if (this.config.agent.dryRun) {
      this.logger.info(`[DRY RUN] Would execute: ${command.type} on ${command.targetRef}`);
      return {
        command,
        success: true,
        details: 'Dry run - no action taken',
      };
    }

    try {
      switch (command.type) {
        case 'reply': {
          // Get original email details for reply
          const original = await this.gmail.getEmail(gmailId, 0);
          await this.gmail.replyToEmail(
            gmailId,
            original.threadId,
            original.from.address,
            original.subject,
            `<p>${command.content.replace(/\n/g, '<br/>')}</p>`
          );
          this.logger.info(`Replied to ${command.targetRef}`);
          break;
        }

        case 'forward': {
          const original = await this.gmail.getEmail(gmailId, 0);
          const forwardBody = `
            <p>${command.note || 'Forwarded message:'}</p>
            <hr/>
            <p><strong>From:</strong> ${original.from.address}<br/>
            <strong>Subject:</strong> ${original.subject}<br/>
            <strong>Date:</strong> ${original.date.toISOString()}</p>
            <div>${original.body.html || original.body.plain}</div>
          `;
          await this.gmail.sendEmail(
            command.forwardTo,
            `Fwd: ${original.subject}`,
            forwardBody
          );
          this.logger.info(`Forwarded ${command.targetRef} to ${command.forwardTo}`);
          break;
        }

        case 'archive':
          await this.gmail.archiveEmail(gmailId);
          this.logger.info(`Archived ${command.targetRef}`);
          break;

        case 'delete':
          await this.gmail.deleteEmail(gmailId);
          this.logger.info(`Deleted ${command.targetRef}`);
          break;

        case 'mark_read':
          await this.gmail.markAsRead(gmailId);
          this.logger.info(`Marked ${command.targetRef} as read`);
          break;

        case 'mark_unread':
          await this.gmail.markAsUnread(gmailId);
          this.logger.info(`Marked ${command.targetRef} as unread`);
          break;

        case 'star':
          await this.gmail.starEmail(gmailId);
          this.logger.info(`Starred ${command.targetRef}`);
          break;

        case 'unstar':
          await this.gmail.unstarEmail(gmailId);
          this.logger.info(`Unstarred ${command.targetRef}`);
          break;

        case 'label':
          await this.gmail.addLabel(gmailId, command.labelName);
          this.logger.info(`Added label "${command.labelName}" to ${command.targetRef}`);
          break;
      }

      return { command, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to execute ${command.type} on ${command.targetRef}`, { error });
      return {
        command,
        success: false,
        error: errorMessage,
      };
    }
  }

  private async sendConfirmationEmail(results: CommandResult[]): Promise<void> {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    const successHtml = successful.length > 0
      ? successful
          .map((r) => `<li>✅ ${commandTypeToLabel(r.command.type)} ${r.command.targetRef}</li>`)
          .join('')
      : '<li>No successful actions</li>';

    const failedHtml = failed.length > 0
      ? failed
          .map((r) => `<li>❌ ${commandTypeToLabel(r.command.type)} ${r.command.targetRef}: ${r.error}</li>`)
          .join('')
      : '';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

  <h1 style="color: #333;">✅ Agent Actions Completed</h1>

  <p style="color: #666;">${formatDate(new Date())}</p>

  <h2 style="color: #28a745;">Completed Actions (${successful.length})</h2>
  <ul>${successHtml}</ul>

  ${failed.length > 0 ? `
  <h2 style="color: #dc3545;">Failed Actions (${failed.length})</h2>
  <ul>${failedHtml}</ul>
  ` : ''}

  <p style="font-size: 12px; color: #999; margin-top: 30px;">
    Generated by Email Agent
  </p>

</body>
</html>`;

    await this.gmail.sendEmail(
      this.config.user.email,
      `Agent Actions Completed - ${formatDate(new Date())}`,
      htmlBody
    );

    this.logger.info('Sent confirmation email');
  }
}

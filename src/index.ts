import { loadConfig } from './config/index.js';
import { GmailAuth, GmailClient } from './services/gmail/index.js';
import { ClaudeClient, EmailSummarizer, CommandParser } from './services/ai/index.js';
import { SummaryHandler, CommandHandler } from './handlers/index.js';
import { createLogger } from './utils/logger.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logging.level, config.paths.logs);

  logger.info('Starting Email Agent');

  try {
    // Initialize Gmail authentication
    const auth = new GmailAuth(config);
    const hasTokens = await auth.initialize();

    if (!hasTokens) {
      logger.error('No valid Gmail tokens found. Please run "npm run setup-oauth" first.');
      process.exit(1);
    }

    // Initialize services
    const gmail = new GmailClient(auth, config);
    const claude = new ClaudeClient(config, logger);
    const summarizer = new EmailSummarizer(claude, logger);
    const parser = new CommandParser(claude, logger);

    // Initialize handlers
    const summaryHandler = new SummaryHandler(gmail, summarizer, config, logger);
    const commandHandler = new CommandHandler(gmail, parser, summaryHandler, config, logger);

    // Run the daily workflow
    logger.info('Generating daily summary...');
    const result = await summaryHandler.generateAndSendSummary();

    if (result) {
      logger.info(`Summary generated successfully. ${result.summary.actionItems.length} action items, ${result.summary.informational.length} informational.`);
    } else {
      logger.info('No emails to summarize.');
    }

    // Process any pending commands from previous summary replies
    if (config.agent.enableCommandProcessing) {
      logger.info('Checking for reply commands...');
      const commandResults = await commandHandler.processReplyCommands();

      if (commandResults.length > 0) {
        const successful = commandResults.filter((r) => r.success).length;
        const failed = commandResults.filter((r) => !r.success).length;
        logger.info(`Processed ${commandResults.length} commands: ${successful} successful, ${failed} failed`);
      }
    }

    logger.info('Email Agent completed successfully');
  } catch (error) {
    logger.error('Email Agent failed', { error });
    process.exit(1);
  }
}

main();

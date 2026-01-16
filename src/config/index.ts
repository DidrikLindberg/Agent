import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const configSchema = z.object({
  google: z.object({
    clientId: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
    clientSecret: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
    redirectUri: z.string().url().default('http://localhost:3000/callback'),
  }),
  anthropic: z.object({
    apiKey: z.string().startsWith('sk-ant-', 'Invalid Anthropic API key format'),
    model: z.string().default('claude-sonnet-4-20250514'),
  }),
  user: z.object({
    email: z.string().email('USER_EMAIL must be a valid email'),
  }),
  agent: z.object({
    emailLookbackHours: z.number().positive().default(24),
    maxEmailsPerRun: z.number().positive().default(50),
    enableCommandProcessing: z.boolean().default(true),
    dryRun: z.boolean().default(false),
  }),
  paths: z.object({
    tokenStorage: z.string(),
    summaryStorage: z.string(),
    logs: z.string(),
    projectRoot: z.string(),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const rawConfig = {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/callback',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    },
    user: {
      email: process.env.USER_EMAIL || '',
    },
    agent: {
      emailLookbackHours: parseInt(process.env.EMAIL_LOOKBACK_HOURS || '24', 10),
      maxEmailsPerRun: parseInt(process.env.MAX_EMAILS_PER_RUN || '50', 10),
      enableCommandProcessing: process.env.ENABLE_COMMAND_PROCESSING !== 'false',
      dryRun: process.env.DRY_RUN === 'true',
    },
    paths: {
      tokenStorage: path.resolve(PROJECT_ROOT, process.env.TOKEN_STORAGE_PATH || './data/tokens.json'),
      summaryStorage: path.resolve(PROJECT_ROOT, process.env.SUMMARY_STORAGE_PATH || './data/summaries'),
      logs: path.resolve(PROJECT_ROOT, process.env.LOG_PATH || './logs'),
      projectRoot: PROJECT_ROOT,
    },
    logging: {
      level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    },
  };

  return configSchema.parse(rawConfig);
}

// Partial config for OAuth setup (doesn't require all fields)
const oauthConfigSchema = z.object({
  google: z.object({
    clientId: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
    clientSecret: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
    redirectUri: z.string().url().default('http://localhost:3000/callback'),
  }),
  paths: z.object({
    tokenStorage: z.string(),
    projectRoot: z.string(),
  }),
});

export type OAuthConfig = z.infer<typeof oauthConfigSchema>;

export function loadOAuthConfig(): OAuthConfig {
  const rawConfig = {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/callback',
    },
    paths: {
      tokenStorage: path.resolve(PROJECT_ROOT, process.env.TOKEN_STORAGE_PATH || './data/tokens.json'),
      projectRoot: PROJECT_ROOT,
    },
  };

  return oauthConfigSchema.parse(rawConfig);
}

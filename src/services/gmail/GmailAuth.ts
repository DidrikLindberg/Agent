import { OAuth2Client, Credentials } from 'google-auth-library';
import fs from 'fs/promises';
import path from 'path';
import type { Config, OAuthConfig } from '../../config/index.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

export class GmailAuth {
  private oauth2Client: OAuth2Client;
  private tokenPath: string;

  constructor(config: Config | OAuthConfig) {
    this.oauth2Client = new OAuth2Client(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
    this.tokenPath = config.paths.tokenStorage;
  }

  getClient(): OAuth2Client {
    return this.oauth2Client;
  }

  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  async exchangeCodeForTokens(code: string): Promise<Credentials> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    await this.saveTokens(tokens);
    return tokens;
  }

  async initialize(): Promise<boolean> {
    const tokens = await this.loadTokens();
    if (!tokens) {
      return false;
    }

    this.oauth2Client.setCredentials(tokens);

    // Check if token is expired or will expire soon (within 5 minutes)
    const expiryDate = tokens.expiry_date;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiryDate && expiryDate - now < fiveMinutes) {
      await this.refreshAccessToken();
    }

    return true;
  }

  async refreshAccessToken(): Promise<void> {
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    this.oauth2Client.setCredentials(credentials);
    await this.saveTokens(credentials);
  }

  private async saveTokens(tokens: Credentials): Promise<void> {
    const dir = path.dirname(this.tokenPath);
    await fs.mkdir(dir, { recursive: true });

    const storedTokens: StoredTokens = {
      access_token: tokens.access_token || '',
      refresh_token: tokens.refresh_token || '',
      expiry_date: tokens.expiry_date || 0,
      token_type: tokens.token_type || 'Bearer',
      scope: tokens.scope || SCOPES.join(' '),
    };

    await fs.writeFile(this.tokenPath, JSON.stringify(storedTokens, null, 2));
  }

  private async loadTokens(): Promise<Credentials | null> {
    try {
      const content = await fs.readFile(this.tokenPath, 'utf-8');
      const tokens: StoredTokens = JSON.parse(content);
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        token_type: tokens.token_type,
        scope: tokens.scope,
      };
    } catch {
      return null;
    }
  }

  async hasValidTokens(): Promise<boolean> {
    const tokens = await this.loadTokens();
    return tokens !== null && !!tokens.refresh_token;
  }
}

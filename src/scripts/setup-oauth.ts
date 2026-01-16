import http from 'http';
import { URL } from 'url';
import { loadOAuthConfig } from '../config/index.js';
import { GmailAuth } from '../services/gmail/GmailAuth.js';

async function main() {
  console.log('=== Gmail OAuth Setup ===\n');

  let config;
  try {
    config = loadOAuthConfig();
  } catch (error) {
    console.error('Configuration error:', error instanceof Error ? error.message : error);
    console.log('\nPlease ensure you have set the following environment variables:');
    console.log('  - GOOGLE_CLIENT_ID');
    console.log('  - GOOGLE_CLIENT_SECRET');
    console.log('\nYou can set these in a .env file in the project root.');
    process.exit(1);
  }

  const auth = new GmailAuth(config);

  // Check if we already have valid tokens
  const hasTokens = await auth.hasValidTokens();
  if (hasTokens) {
    console.log('Valid tokens already exist. Checking if they work...');
    try {
      await auth.initialize();
      console.log('✅ Existing tokens are valid. No setup needed.');
      process.exit(0);
    } catch {
      console.log('Existing tokens are invalid. Starting new OAuth flow...\n');
    }
  }

  // Generate the authorization URL
  const authUrl = auth.getAuthUrl();

  console.log('Please visit the following URL to authorize this application:\n');
  console.log(authUrl);
  console.log('\nWaiting for authorization...\n');

  // Start a local server to receive the OAuth callback
  return new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '', `http://localhost:3000`);

        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                  <h1 style="color: #dc3545;">❌ Authorization Failed</h1>
                  <p>Error: ${error}</p>
                  <p>Please try again.</p>
                </body>
              </html>
            `);
            server.close();
            reject(new Error(`OAuth error: ${error}`));
            return;
          }

          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                  <h1 style="color: #dc3545;">❌ No Authorization Code</h1>
                  <p>No authorization code was received.</p>
                </body>
              </html>
            `);
            return;
          }

          // Exchange the code for tokens
          console.log('Received authorization code. Exchanging for tokens...');
          await auth.exchangeCodeForTokens(code);

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #28a745;">✅ Authorization Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
                <p>The Email Agent is now authorized to access your Gmail.</p>
              </body>
            </html>
          `);

          console.log('\n✅ Authorization successful!');
          console.log('Tokens have been saved. You can now run the agent with "npm run dev".\n');

          server.close();
          resolve();
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
        }
      } catch (error) {
        console.error('Error handling callback:', error);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #dc3545;">❌ Error</h1>
              <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
            </body>
          </html>
        `);
        server.close();
        reject(error);
      }
    });

    server.listen(3000, () => {
      console.log('Local server started on http://localhost:3000');
      console.log('Waiting for OAuth callback...\n');
    });

    server.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        console.error('Port 3000 is already in use. Please close any application using this port.');
      } else {
        console.error('Server error:', error);
      }
      reject(error);
    });
  });
}

main().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});

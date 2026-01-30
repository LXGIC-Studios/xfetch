import chalk from 'chalk';
import { XClient } from '../lib/client/index.js';
import { SessionManager } from '../lib/auth/session.js';
import { createSessionFromTokens } from '../lib/auth/cookies.js';
import type { Session } from '../types/twitter.js';

interface GlobalOptions {
  authToken?: string;
  ct0?: string;
  format?: string;
  json?: boolean;
  plain?: boolean;
}

export async function getClient(options: GlobalOptions = {}): Promise<XClient> {
  let session: Session | null = null;

  // Priority 1: Direct tokens from CLI
  if (options.authToken && options.ct0) {
    session = createSessionFromTokens(options.authToken, options.ct0);
  }
  
  // Priority 2: Saved session
  if (!session) {
    const sessionManager = new SessionManager();
    session = sessionManager.load();
  }

  if (!session || !session.authToken || !session.ct0) {
    console.error(chalk.red('Not authenticated.'));
    console.error('');
    console.error('Use one of:');
    console.error('  xfetch auth set --auth-token <token> --ct0 <token>');
    console.error('  xfetch auth extract --browser chrome');
    console.error('  xfetch --auth-token <token> --ct0 <token> <command>');
    process.exit(1);
  }

  return new XClient(session);
}

export function outputResult(data: any, options: GlobalOptions = {}): void {
  const format = options.json ? 'json' : (options.format || 'json');
  
  switch (format) {
    case 'json':
      console.log(JSON.stringify(data, null, options.plain ? 0 : 2));
      break;
    case 'jsonl':
      if (Array.isArray(data)) {
        data.forEach(item => console.log(JSON.stringify(item)));
      } else if (data.items) {
        data.items.forEach((item: any) => console.log(JSON.stringify(item)));
      } else {
        console.log(JSON.stringify(data));
      }
      break;
    case 'csv':
      // TODO: Implement CSV output
      console.log(JSON.stringify(data, null, 2));
      break;
    default:
      console.log(JSON.stringify(data, null, 2));
  }
}

export function extractTweetId(urlOrId: string): string {
  // If it's already an ID
  if (/^\d+$/.test(urlOrId)) {
    return urlOrId;
  }
  
  // Extract from URL
  const match = urlOrId.match(/status\/(\d+)/);
  if (match) {
    return match[1];
  }
  
  throw new Error(`Invalid tweet URL or ID: ${urlOrId}`);
}

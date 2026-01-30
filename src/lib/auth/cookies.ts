import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Session } from '../../types/twitter.js';

type BrowserType = 'chrome' | 'firefox' | 'safari' | 'arc' | 'brave';

interface ExtractOptions {
  browser?: BrowserType;
  profile?: string;
  profileDir?: string;
}

// Browser cookie paths
const COOKIE_PATHS: Record<BrowserType, string> = {
  chrome: join(homedir(), 'Library/Application Support/Google/Chrome'),
  firefox: join(homedir(), 'Library/Application Support/Firefox/Profiles'),
  safari: join(homedir(), 'Library/Cookies/Cookies.binarycookies'),
  arc: join(homedir(), 'Library/Application Support/Arc/User Data'),
  brave: join(homedir(), 'Library/Application Support/BraveSoftware/Brave-Browser'),
};

export async function extractCookies(options: ExtractOptions = {}): Promise<Session | null> {
  const { browser = 'chrome', profile = 'Default' } = options;

  // For now, return a placeholder - real implementation would use
  // platform-specific cookie extraction libraries
  console.warn(`Cookie extraction from ${browser} not yet implemented`);
  console.warn('Use --auth-token and --ct0 to provide credentials directly');
  
  return null;
}

export function getAvailableBrowsers(): BrowserType[] {
  const available: BrowserType[] = [];
  
  for (const [browser, path] of Object.entries(COOKIE_PATHS)) {
    if (existsSync(path)) {
      available.push(browser as BrowserType);
    }
  }
  
  return available;
}

export function createSessionFromTokens(authToken: string, ct0: string): Session {
  return {
    authToken,
    ct0,
  };
}

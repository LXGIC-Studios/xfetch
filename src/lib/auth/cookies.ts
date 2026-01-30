import { existsSync, readFileSync, readdirSync, copyFileSync, unlinkSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { createDecipheriv, pbkdf2Sync } from 'crypto';
import initSqlJs, { Database } from 'sql.js';
import type { Session } from '../../types/twitter.js';

export type BrowserType = 'chrome' | 'firefox' | 'safari' | 'arc' | 'brave';

interface ExtractOptions {
  browser?: BrowserType;
  profile?: string;
  profileDir?: string;
}

interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
}

// Browser cookie paths for macOS
const BROWSER_PATHS: Record<BrowserType, string> = {
  chrome: join(homedir(), 'Library/Application Support/Google/Chrome'),
  firefox: join(homedir(), 'Library/Application Support/Firefox/Profiles'),
  safari: join(homedir(), 'Library/Cookies/Cookies.binarycookies'),
  arc: join(homedir(), 'Library/Application Support/Arc/User Data'),
  brave: join(homedir(), 'Library/Application Support/BraveSoftware/Brave-Browser'),
};

// Keychain service names for Chrome-based browsers
const KEYCHAIN_SERVICES: Partial<Record<BrowserType, string>> = {
  chrome: 'Chrome Safe Storage',
  arc: 'Arc Safe Storage',
  brave: 'Brave Safe Storage',
};

/**
 * Extract X/Twitter cookies from a browser
 */
export async function extractCookies(options: ExtractOptions = {}): Promise<Session | null> {
  const { browser = 'chrome', profile = 'Default' } = options;

  try {
    let cookies: Cookie[];

    switch (browser) {
      case 'chrome':
      case 'arc':
      case 'brave':
        cookies = await extractChromeCookies(browser, profile);
        break;
      case 'firefox':
        cookies = await extractFirefoxCookies(profile);
        break;
      case 'safari':
        cookies = await extractSafariCookies();
        break;
      default:
        throw new Error(`Unsupported browser: ${browser}`);
    }

    // Find the X/Twitter cookies we need
    const authTokenCookie = cookies.find(
      (c) => c.name === 'auth_token' && (c.domain.includes('twitter.com') || c.domain.includes('x.com'))
    );
    const ct0Cookie = cookies.find(
      (c) => c.name === 'ct0' && (c.domain.includes('twitter.com') || c.domain.includes('x.com'))
    );

    if (!authTokenCookie || !ct0Cookie) {
      console.error('Could not find required X/Twitter cookies (auth_token, ct0)');
      console.error('Make sure you are logged into X/Twitter in the browser');
      return null;
    }

    return {
      authToken: authTokenCookie.value,
      ct0: ct0Cookie.value,
    };
  } catch (error) {
    console.error(`Failed to extract cookies from ${browser}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Extract cookies from Chrome-based browsers (Chrome, Arc, Brave)
 */
async function extractChromeCookies(browser: BrowserType, profile: string): Promise<Cookie[]> {
  const basePath = BROWSER_PATHS[browser];
  const cookiePath = join(basePath, profile, 'Cookies');

  if (!existsSync(cookiePath)) {
    throw new Error(`Cookie file not found: ${cookiePath}`);
  }

  // Get decryption key from keychain
  const keychainService = KEYCHAIN_SERVICES[browser];
  if (!keychainService) {
    throw new Error(`No keychain service defined for ${browser}`);
  }

  const encryptionKey = getChromeEncryptionKey(keychainService);

  // Copy cookies file to temp location (Chrome may have it locked)
  const tempPath = join(tmpdir(), `xfetch-cookies-${Date.now()}.db`);
  copyFileSync(cookiePath, tempPath);

  try {
    const SQL = await initSqlJs();
    const dbBuffer = readFileSync(tempPath);
    const db = new SQL.Database(dbBuffer);

    const cookies = extractCookiesFromChromeDb(db, encryptionKey);
    db.close();

    return cookies;
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get Chrome encryption key from macOS keychain
 */
function getChromeEncryptionKey(service: string): Buffer {
  try {
    // Use security command to get password from keychain
    const result = execSync(
      `security find-generic-password -s "${service}" -w`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    // Derive the actual key using PBKDF2
    // Chrome uses 1003 iterations and 'saltysalt' as salt on macOS
    const key = pbkdf2Sync(result, 'saltysalt', 1003, 16, 'sha1');
    return key;
  } catch (error) {
    throw new Error(
      `Failed to get encryption key from keychain. Make sure the browser has been opened at least once. ` +
        `You may need to allow keychain access when prompted. Error: ${error instanceof Error ? error.message : error}`
    );
  }
}

/**
 * Extract and decrypt cookies from Chrome SQLite database
 */
function extractCookiesFromChromeDb(db: Database, key: Buffer): Cookie[] {
  const cookies: Cookie[] = [];

  // Query for Twitter/X cookies
  const stmt = db.prepare(`
    SELECT name, encrypted_value, host_key, path, expires_utc 
    FROM cookies 
    WHERE host_key LIKE '%twitter.com' OR host_key LIKE '%x.com'
  `);

  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      name: string;
      encrypted_value: Uint8Array;
      host_key: string;
      path: string;
      expires_utc: number;
    };

    const decryptedValue = decryptChromeCookie(row.encrypted_value, key);
    if (decryptedValue) {
      cookies.push({
        name: row.name,
        value: decryptedValue,
        domain: row.host_key,
        path: row.path,
        expires: row.expires_utc,
      });
    }
  }

  stmt.free();
  return cookies;
}

/**
 * Decrypt a Chrome cookie value
 */
function decryptChromeCookie(encryptedValue: Uint8Array, key: Buffer): string | null {
  if (!encryptedValue || encryptedValue.length === 0) {
    return null;
  }

  const encrypted = Buffer.from(encryptedValue);

  // Check for v10 prefix (used on macOS)
  if (encrypted.length > 3 && encrypted.slice(0, 3).toString() === 'v10') {
    try {
      // Remove 'v10' prefix
      const payload = encrypted.slice(3);
      // Chrome uses AES-128-CBC with a 16-byte IV of spaces
      const iv = Buffer.alloc(16, ' ');
      const decipher = createDecipheriv('aes-128-cbc', key, iv);
      decipher.setAutoPadding(true);

      let decrypted = decipher.update(payload);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      // The decrypted data has some garbage at the beginning due to CBC mode
      // The actual cookie value is a hex string that we need to extract
      const decryptedStr = decrypted.toString('utf8');

      // For Twitter/X cookies (auth_token, ct0), values are hex strings
      // auth_token is 40 chars, ct0 is 160 chars
      // Find the longest hex-like string in the decrypted data
      const hexMatch = decryptedStr.match(/[a-f0-9]{32,}/i);
      if (hexMatch) {
        return hexMatch[0];
      }

      // If no hex match, try to extract printable ASCII after garbage
      // Skip initial garbage bytes and find clean ASCII
      let cleanStart = 0;
      for (let i = 0; i < decrypted.length; i++) {
        // Look for start of clean alphanumeric sequence
        if (decrypted[i] >= 48 && decrypted[i] <= 122) {
          // Check if next few chars are also clean
          let cleanCount = 0;
          for (let j = i; j < Math.min(i + 10, decrypted.length); j++) {
            const c = decrypted[j];
            if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) {
              cleanCount++;
            }
          }
          if (cleanCount >= 8) {
            cleanStart = i;
            break;
          }
        }
      }

      if (cleanStart > 0) {
        // Remove PKCS7 padding if present
        const lastByte = decrypted[decrypted.length - 1];
        const endPos = lastByte <= 16 ? decrypted.length - lastByte : decrypted.length;
        return decrypted.slice(cleanStart, endPos).toString('utf8').trim();
      }

      return decryptedStr;
    } catch {
      return null;
    }
  }

  // Check for v11 prefix (macOS 10.14+)
  if (encrypted.length > 3 && encrypted.slice(0, 3).toString() === 'v11') {
    // v11 uses AES-256-GCM - not commonly seen yet
    // Fall through to unencrypted handling for now
    return null;
  }

  // Unencrypted value (older Chrome or some platforms)
  return encrypted.toString('utf8');
}

/**
 * Extract cookies from Firefox
 */
async function extractFirefoxCookies(profile?: string): Promise<Cookie[]> {
  const profilesPath = BROWSER_PATHS.firefox;

  if (!existsSync(profilesPath)) {
    throw new Error('Firefox profiles directory not found');
  }

  // Find the profile directory
  let profileDir: string;

  if (profile) {
    // Look for profile by name
    const dirs = readdirSync(profilesPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const match = dirs.find((d) => d.includes(profile) || d.endsWith(`.${profile}`));
    if (match) {
      profileDir = join(profilesPath, match);
    } else {
      throw new Error(`Firefox profile not found: ${profile}`);
    }
  } else {
    // Use default profile (look for .default or .default-release)
    const dirs = readdirSync(profilesPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const defaultProfile = dirs.find((d) => d.includes('.default-release')) || dirs.find((d) => d.includes('.default'));

    if (!defaultProfile) {
      throw new Error('No default Firefox profile found');
    }
    profileDir = join(profilesPath, defaultProfile);
  }

  const cookiePath = join(profileDir, 'cookies.sqlite');
  if (!existsSync(cookiePath)) {
    throw new Error(`Firefox cookies.sqlite not found in profile`);
  }

  // Copy to temp location (Firefox may have it locked)
  const tempPath = join(tmpdir(), `xfetch-ff-cookies-${Date.now()}.db`);
  copyFileSync(cookiePath, tempPath);

  try {
    const SQL = await initSqlJs();
    const dbBuffer = readFileSync(tempPath);
    const db = new SQL.Database(dbBuffer);

    const cookies: Cookie[] = [];

    const stmt = db.prepare(`
      SELECT name, value, host, path, expiry 
      FROM moz_cookies 
      WHERE host LIKE '%twitter.com' OR host LIKE '%x.com'
    `);

    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        name: string;
        value: string;
        host: string;
        path: string;
        expiry: number;
      };

      cookies.push({
        name: row.name,
        value: row.value,
        domain: row.host,
        path: row.path,
        expires: row.expiry,
      });
    }

    stmt.free();
    db.close();

    return cookies;
  } finally {
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Extract cookies from Safari binary cookies file
 */
async function extractSafariCookies(): Promise<Cookie[]> {
  const cookiePath = BROWSER_PATHS.safari;

  if (!existsSync(cookiePath)) {
    throw new Error('Safari cookies file not found');
  }

  const buffer = readFileSync(cookiePath);
  return parseBinaryCookies(buffer);
}

/**
 * Parse Safari's binary cookies format
 */
function parseBinaryCookies(buffer: Buffer): Cookie[] {
  const cookies: Cookie[] = [];

  // Check magic bytes 'cook'
  if (buffer.slice(0, 4).toString() !== 'cook') {
    throw new Error('Invalid Safari cookies file format');
  }

  // Number of pages (big endian)
  const numPages = buffer.readUInt32BE(4);

  // Page sizes follow
  const pageSizes: number[] = [];
  for (let i = 0; i < numPages; i++) {
    pageSizes.push(buffer.readUInt32BE(8 + i * 4));
  }

  // Pages start after header
  let pageOffset = 8 + numPages * 4;

  for (const pageSize of pageSizes) {
    const pageBuffer = buffer.slice(pageOffset, pageOffset + pageSize);
    const pageCookies = parseCookiePage(pageBuffer);

    // Filter for Twitter/X cookies
    for (const cookie of pageCookies) {
      if (cookie.domain.includes('twitter.com') || cookie.domain.includes('x.com')) {
        cookies.push(cookie);
      }
    }

    pageOffset += pageSize;
  }

  return cookies;
}

/**
 * Parse a page of Safari cookies
 */
function parseCookiePage(buffer: Buffer): Cookie[] {
  const cookies: Cookie[] = [];

  // Page header check (0x00000100)
  const pageHeader = buffer.readUInt32BE(0);
  if (pageHeader !== 0x00000100) {
    return cookies;
  }

  // Number of cookies in this page (little endian)
  const numCookies = buffer.readUInt32LE(4);

  // Cookie offsets
  const offsets: number[] = [];
  for (let i = 0; i < numCookies; i++) {
    offsets.push(buffer.readUInt32LE(8 + i * 4));
  }

  for (const offset of offsets) {
    try {
      const cookie = parseCookieData(buffer, offset);
      if (cookie) {
        cookies.push(cookie);
      }
    } catch {
      // Skip malformed cookies
    }
  }

  return cookies;
}

/**
 * Parse individual cookie data from Safari format
 */
function parseCookieData(buffer: Buffer, offset: number): Cookie | null {
  // Cookie size (little endian)
  const size = buffer.readUInt32LE(offset);
  if (size === 0 || offset + size > buffer.length) {
    return null;
  }

  // Flags at offset + 8
  // const flags = buffer.readUInt32LE(offset + 8);

  // Offsets to strings (relative to cookie start)
  const urlOffset = buffer.readUInt32LE(offset + 16);
  const nameOffset = buffer.readUInt32LE(offset + 20);
  const pathOffset = buffer.readUInt32LE(offset + 24);
  const valueOffset = buffer.readUInt32LE(offset + 28);

  // Expiry date (Mac absolute time - seconds since 2001-01-01)
  const expiryDate = buffer.readDoubleLE(offset + 40);

  // Read null-terminated strings
  const readString = (strOffset: number): string => {
    let end = offset + strOffset;
    while (end < buffer.length && buffer[end] !== 0) {
      end++;
    }
    return buffer.slice(offset + strOffset, end).toString('utf8');
  };

  const domain = readString(urlOffset);
  const name = readString(nameOffset);
  const path = readString(pathOffset);
  const value = readString(valueOffset);

  // Convert Mac absolute time to Unix timestamp
  const MAC_EPOCH_OFFSET = 978307200; // Seconds between 1970 and 2001
  const expires = expiryDate + MAC_EPOCH_OFFSET;

  return { name, value, domain, path, expires };
}

/**
 * Get list of available browsers
 */
export function getAvailableBrowsers(): BrowserType[] {
  const available: BrowserType[] = [];

  for (const [browser, path] of Object.entries(BROWSER_PATHS)) {
    if (existsSync(path)) {
      available.push(browser as BrowserType);
    }
  }

  return available;
}

/**
 * Create a session from raw tokens
 */
export function createSessionFromTokens(authToken: string, ct0: string): Session {
  return {
    authToken,
    ct0,
  };
}

/**
 * List available profiles for a browser
 */
export function getBrowserProfiles(browser: BrowserType): string[] {
  const basePath = BROWSER_PATHS[browser];

  if (!existsSync(basePath)) {
    return [];
  }

  switch (browser) {
    case 'chrome':
    case 'arc':
    case 'brave': {
      // Look for directories that contain a Cookies file
      const entries = readdirSync(basePath, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && existsSync(join(basePath, e.name, 'Cookies')))
        .map((e) => e.name);
    }

    case 'firefox': {
      // Firefox profiles are named like 'random.profilename'
      const entries = readdirSync(basePath, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && existsSync(join(basePath, e.name, 'cookies.sqlite')))
        .map((e) => e.name);
    }

    case 'safari':
      // Safari doesn't have profiles
      return ['default'];

    default:
      return [];
  }
}

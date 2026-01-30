import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { Session } from '../../types/twitter.js';

export class SessionManager {
  private configDir: string;
  private sessionFile: string;

  constructor() {
    this.configDir = join(homedir(), '.config', 'xfetch');
    this.sessionFile = join(this.configDir, 'session.json');
  }

  save(session: Session): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }
    writeFileSync(this.sessionFile, JSON.stringify(session, null, 2));
  }

  load(): Session | null {
    if (!existsSync(this.sessionFile)) {
      return null;
    }
    
    try {
      const data = readFileSync(this.sessionFile, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }

  clear(): void {
    if (existsSync(this.sessionFile)) {
      writeFileSync(this.sessionFile, '{}');
    }
  }

  isValid(session: Session): boolean {
    return !!(session.authToken && session.ct0);
  }
}

import type { Session, RateLimitInfo } from '../../types/twitter.js';

interface PooledSession extends Session {
  rateLimits: Map<string, RateLimitInfo>;
  lastUsed: number;
  cooldownUntil?: number;
}

export class SessionPool {
  private sessions: PooledSession[] = [];
  private currentIndex: number = 0;

  add(session: Session): void {
    this.sessions.push({
      ...session,
      rateLimits: new Map(),
      lastUsed: 0,
    });
  }

  remove(index: number): void {
    this.sessions.splice(index, 1);
  }

  get size(): number {
    return this.sessions.length;
  }

  getNext(): Session | null {
    if (this.sessions.length === 0) return null;

    // Find a session that's not in cooldown
    const now = Date.now();
    const availableSessions = this.sessions.filter(
      s => !s.cooldownUntil || s.cooldownUntil < now
    );

    if (availableSessions.length === 0) {
      // All sessions in cooldown, return the one with earliest cooldown end
      const sortedByCooldown = [...this.sessions].sort(
        (a, b) => (a.cooldownUntil || 0) - (b.cooldownUntil || 0)
      );
      return sortedByCooldown[0];
    }

    // Round-robin among available sessions
    const session = availableSessions[this.currentIndex % availableSessions.length];
    this.currentIndex++;
    session.lastUsed = now;

    return {
      authToken: session.authToken,
      ct0: session.ct0,
      username: session.username,
      userId: session.userId,
    };
  }

  markLimited(session: Session, endpoint: string, resetTime: number): void {
    const pooledSession = this.sessions.find(
      s => s.authToken === session.authToken
    );
    
    if (pooledSession) {
      pooledSession.rateLimits.set(endpoint, {
        limit: 0,
        remaining: 0,
        reset: resetTime,
      });
      
      // Put in cooldown for 24 hours if hitting hard limit
      pooledSession.cooldownUntil = Date.now() + 24 * 60 * 60 * 1000;
    }
  }

  getAvailableCount(): number {
    const now = Date.now();
    return this.sessions.filter(
      s => !s.cooldownUntil || s.cooldownUntil < now
    ).length;
  }
}

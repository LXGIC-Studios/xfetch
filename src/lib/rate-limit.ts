import type { RateLimitInfo } from '../types/twitter.js';

interface EndpointLimit {
  info: RateLimitInfo;
  lastUpdated: number;
}

export class RateLimiter {
  private limits: Map<string, EndpointLimit> = new Map();
  private backoffMs: number = 60000; // 1 minute backoff

  update(endpoint: string, info: RateLimitInfo): void {
    this.limits.set(endpoint, {
      info,
      lastUpdated: Date.now(),
    });
  }

  async waitIfNeeded(endpoint: string): Promise<void> {
    const limit = this.limits.get(endpoint);
    if (!limit) return;

    const { info, lastUpdated } = limit;
    
    // If we have remaining requests, we're good
    if (info.remaining > 5) return;

    // If reset time has passed, we're good
    const resetTime = info.reset * 1000;
    if (Date.now() > resetTime) {
      this.limits.delete(endpoint);
      return;
    }

    // Wait until reset
    if (info.remaining <= 0) {
      const waitMs = resetTime - Date.now() + 1000; // Add 1s buffer
      console.warn(`Rate limited on ${endpoint}. Waiting ${Math.ceil(waitMs / 1000)}s...`);
      await this.sleep(waitMs);
      return;
    }

    // Low remaining - add small delay
    if (info.remaining <= 5) {
      await this.sleep(this.backoffMs / info.remaining);
    }
  }

  getRemainingForEndpoint(endpoint: string): number | null {
    const limit = this.limits.get(endpoint);
    return limit?.info.remaining ?? null;
  }

  getResetTimeForEndpoint(endpoint: string): Date | null {
    const limit = this.limits.get(endpoint);
    if (!limit) return null;
    return new Date(limit.info.reset * 1000);
  }

  isLimited(endpoint: string): boolean {
    const limit = this.limits.get(endpoint);
    if (!limit) return false;
    
    const { info } = limit;
    const resetTime = info.reset * 1000;
    
    return info.remaining <= 0 && Date.now() < resetTime;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

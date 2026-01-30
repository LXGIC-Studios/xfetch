import { request } from 'undici';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// Fallback query IDs (updated with each release)
const FALLBACK_QUERY_IDS: Record<string, string> = {
  // User endpoints
  'UserByScreenName': '1VOOyvKkiI3FMmkeDNxM9A',
  'UserByRestId': 'tD8zKvQzwY3kdx5yz6YmOw',
  'UsersByRestIds': 'XArUHrueMW0KQdZUdqidrA',
  
  // Tweet endpoints
  'TweetDetail': 'xd_EMdYvB9hfZsZ6Idri0w',
  'TweetResultByRestId': '7xflPyRiUxGVbJd4uWmbfg',
  'UserTweets': 'q6xj5bs0hapm9309hexA_g',
  'UserTweetsAndReplies': '6hvhmQQ9zPIR8RZWHFAm4w',
  'UserMedia': '1H9ibIdchWO0_vz3wJLDTA',
  'Likes': 'lIDpu_NWL7_VhimGGt0o6A',
  
  // Timeline endpoints
  'HomeTimeline': 'c-CzHF1LboFilMpsx4ZCrQ',
  'HomeLatestTimeline': 'BKB7oi212Fi7kQtCBGE4zA',
  'Bookmarks': '2neUNDqrrFzbLui8yallcQ',
  
  // Search
  'SearchTimeline': 'VhUd6vHVmLBcw0uX-6jMLA',
  
  // Social graph
  'Followers': 'IOh4aS6UdGWGJUYTqliQ7Q',
  'Following': 'zx6e-TLzRkeDO_a7p4b3JQ',
  
  // Lists
  'ListLatestTweetsTimeline': 'RlZzktZY_9wJynoepm8ZsA',
};

interface CachedQueryIds {
  ids: Record<string, string>;
  fetchedAt: number;
}

export class QueryIdManager {
  private cacheFile: string;
  private cache: CachedQueryIds | null = null;
  private cacheTTL: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    const configDir = join(homedir(), '.config', 'xfetch');
    this.cacheFile = join(configDir, 'query-ids.json');
    this.loadCache();
  }

  private loadCache(): void {
    try {
      if (existsSync(this.cacheFile)) {
        const data = readFileSync(this.cacheFile, 'utf-8');
        this.cache = JSON.parse(data);
      }
    } catch (e) {
      this.cache = null;
    }
  }

  private saveCache(ids: Record<string, string>): void {
    const dir = dirname(this.cacheFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    this.cache = {
      ids,
      fetchedAt: Date.now(),
    };
    
    writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
  }

  private isCacheValid(): boolean {
    if (!this.cache) return false;
    return Date.now() - this.cache.fetchedAt < this.cacheTTL;
  }

  async get(operationName: string): Promise<string> {
    // Try cache first
    if (this.isCacheValid() && this.cache?.ids[operationName]) {
      return this.cache.ids[operationName];
    }

    // Try fallback
    if (FALLBACK_QUERY_IDS[operationName]) {
      return FALLBACK_QUERY_IDS[operationName];
    }

    throw new Error(`Unknown GraphQL operation: ${operationName}`);
  }

  async refresh(): Promise<Record<string, string>> {
    try {
      // Fetch X's main.js bundle to extract query IDs
      const response = await request('https://x.com', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      const html = await response.body.text();
      
      // Find the main JS bundle URL
      const bundleMatch = html.match(/https:\/\/abs\.twimg\.com\/responsive-web\/client-web-legacy\/main\.[a-f0-9]+\.js/);
      if (!bundleMatch) {
        console.warn('Could not find X bundle URL, using fallback IDs');
        return FALLBACK_QUERY_IDS;
      }

      const bundleResponse = await request(bundleMatch[0], {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      const bundleJs = await bundleResponse.body.text();
      
      // Extract query IDs from bundle
      const ids: Record<string, string> = { ...FALLBACK_QUERY_IDS };
      
      // Pattern: {queryId:"...",operationName:"..."}
      const pattern = /queryId:"([^"]+)",operationName:"([^"]+)"/g;
      let match;
      
      while ((match = pattern.exec(bundleJs)) !== null) {
        ids[match[2]] = match[1];
      }

      this.saveCache(ids);
      return ids;
    } catch (e) {
      console.warn('Failed to refresh query IDs:', e);
      return FALLBACK_QUERY_IDS;
    }
  }

  list(): Record<string, string> {
    if (this.cache?.ids) {
      return this.cache.ids;
    }
    return FALLBACK_QUERY_IDS;
  }
}

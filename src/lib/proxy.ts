import fs from 'fs';
import path from 'path';

export interface ProxyConfig {
  url: string;
  protocol?: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
}

export interface ProxyStatus {
  url: string;
  failures: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  disabled: boolean;
}

export interface ProxyManagerOptions {
  proxy?: string;
  proxyFile?: string;
  maxFailures?: number;
  failureCooldownMs?: number;
}

export class ProxyManager {
  private proxies: ProxyConfig[] = [];
  private status: Map<string, ProxyStatus> = new Map();
  private currentIndex = 0;
  private options: Required<Omit<ProxyManagerOptions, 'proxy' | 'proxyFile'>> & ProxyManagerOptions;

  constructor(options: ProxyManagerOptions = {}) {
    this.options = {
      maxFailures: 3,
      failureCooldownMs: 5 * 60 * 1000, // 5 minutes
      ...options,
    };

    // Load proxies
    if (options.proxy) {
      this.addProxy(options.proxy);
    }

    if (options.proxyFile) {
      this.loadFromFile(options.proxyFile);
    }
  }

  /**
   * Parse a proxy URL into config
   */
  static parseProxyUrl(url: string): ProxyConfig {
    // Normalize URL
    let normalized = url.trim();
    
    // Add protocol if missing
    if (!normalized.includes('://')) {
      normalized = `http://${normalized}`;
    }

    try {
      const parsed = new URL(normalized);
      const protocol = parsed.protocol.replace(':', '') as ProxyConfig['protocol'];
      
      // Handle SOCKS protocols
      const validProtocol = ['http', 'https', 'socks4', 'socks5'].includes(protocol || '')
        ? protocol
        : 'http';

      const config: ProxyConfig = {
        url: normalized,
        protocol: validProtocol,
        host: parsed.hostname,
        port: parseInt(parsed.port) || (protocol === 'https' ? 443 : 8080),
      };

      if (parsed.username && parsed.password) {
        config.auth = {
          username: decodeURIComponent(parsed.username),
          password: decodeURIComponent(parsed.password),
        };
      }

      return config;
    } catch (e) {
      throw new Error(`Invalid proxy URL: ${url}`);
    }
  }

  /**
   * Add a proxy to the rotation
   */
  addProxy(url: string): void {
    const config = ProxyManager.parseProxyUrl(url);
    
    // Avoid duplicates
    if (this.proxies.some(p => p.url === config.url)) {
      return;
    }

    this.proxies.push(config);
    this.status.set(config.url, {
      url: config.url,
      failures: 0,
      disabled: false,
    });
  }

  /**
   * Load proxies from a file (one per line)
   */
  loadFromFile(filePath: string): void {
    const resolved = path.resolve(filePath);
    
    if (!fs.existsSync(resolved)) {
      throw new Error(`Proxy file not found: ${resolved}`);
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      try {
        this.addProxy(trimmed);
      } catch (e) {
        // Skip invalid proxies, warn in debug
        console.warn(`Skipping invalid proxy: ${trimmed}`);
      }
    }
  }

  /**
   * Get the next available proxy (round-robin)
   */
  getNext(): ProxyConfig | null {
    if (this.proxies.length === 0) {
      return null;
    }

    const availableProxies = this.getAvailableProxies();
    
    if (availableProxies.length === 0) {
      // All proxies failed, reset and try again
      this.resetAllProxies();
      return this.proxies[0] || null;
    }

    // Round-robin selection
    const startIndex = this.currentIndex;
    let attempts = 0;

    while (attempts < this.proxies.length) {
      const proxy = this.proxies[this.currentIndex % this.proxies.length];
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
      attempts++;

      const status = this.status.get(proxy.url);
      if (status && !status.disabled) {
        return proxy;
      }
    }

    // Fallback to first available
    return availableProxies[0] || null;
  }

  /**
   * Get current proxy without advancing
   */
  getCurrent(): ProxyConfig | null {
    if (this.proxies.length === 0) {
      return null;
    }
    return this.proxies[this.currentIndex % this.proxies.length] || null;
  }

  /**
   * Mark a proxy as failed
   */
  markFailed(url: string): void {
    const status = this.status.get(url);
    if (!status) return;

    status.failures++;
    status.lastFailure = new Date();

    if (status.failures >= this.options.maxFailures) {
      status.disabled = true;
      console.warn(`Proxy disabled after ${status.failures} failures: ${url}`);
    }
  }

  /**
   * Mark a proxy as successful
   */
  markSuccess(url: string): void {
    const status = this.status.get(url);
    if (!status) return;

    status.failures = 0;
    status.lastSuccess = new Date();
    status.disabled = false;
  }

  /**
   * Get all available (non-disabled) proxies
   */
  getAvailableProxies(): ProxyConfig[] {
    const now = Date.now();

    return this.proxies.filter(proxy => {
      const status = this.status.get(proxy.url);
      if (!status) return true;

      // Check if cooldown has passed
      if (status.disabled && status.lastFailure) {
        const elapsed = now - status.lastFailure.getTime();
        if (elapsed >= this.options.failureCooldownMs) {
          // Reset after cooldown
          status.disabled = false;
          status.failures = 0;
          return true;
        }
      }

      return !status.disabled;
    });
  }

  /**
   * Reset all proxies (re-enable disabled ones)
   */
  resetAllProxies(): void {
    for (const status of this.status.values()) {
      status.disabled = false;
      status.failures = 0;
    }
  }

  /**
   * Get all proxy statuses
   */
  getStatuses(): ProxyStatus[] {
    return Array.from(this.status.values());
  }

  /**
   * Get count info
   */
  getStats(): { total: number; available: number; disabled: number } {
    const available = this.getAvailableProxies().length;
    return {
      total: this.proxies.length,
      available,
      disabled: this.proxies.length - available,
    };
  }

  /**
   * Check if any proxies are configured
   */
  hasProxies(): boolean {
    return this.proxies.length > 0;
  }

  /**
   * Format proxy for undici dispatcher
   */
  formatForUndici(proxy: ProxyConfig): { uri: string; auth?: string } {
    const uri = `${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`;
    
    if (proxy.auth) {
      const auth = Buffer.from(`${proxy.auth.username}:${proxy.auth.password}`).toString('base64');
      return { uri, auth: `Basic ${auth}` };
    }

    return { uri };
  }
}

/**
 * Create proxy manager from CLI options
 */
export function createProxyManager(options: {
  proxy?: string;
  proxyFile?: string;
}): ProxyManager | null {
  if (!options.proxy && !options.proxyFile) {
    return null;
  }

  return new ProxyManager({
    proxy: options.proxy,
    proxyFile: options.proxyFile,
  });
}

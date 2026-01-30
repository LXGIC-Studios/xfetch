// xfetch - Fast X/Twitter CLI scraper
// Library exports for programmatic use

export { XClient } from './lib/client/index.js';
export { SessionManager } from './lib/auth/session.js';
export { SessionPool } from './lib/auth/pool.js';
export { extractCookies } from './lib/auth/cookies.js';
export { QueryIdManager } from './lib/query-ids/index.js';
export { RateLimiter } from './lib/rate-limit.js';
export * from './types/twitter.js';

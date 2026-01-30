# xfetch - Fast X/Twitter CLI Scraper

> Lightning-fast X/Twitter data extraction. No API keys. Just cookies and go.

## Overview

xfetch is a modern CLI tool for scraping X/Twitter data using the internal GraphQL API. Built on research from 4 parallel deep-dives into Twitter scraping methods.

**Why xfetch over bird?**
- Auto-refreshing query IDs (survives X deployments)
- Multi-format output (JSON, CSV, SQLite, JSONL)
- Session pool management with rate limit awareness
- Transaction ID generation for anti-detection
- Proxy rotation support
- Resume-able pagination

## Architecture

```
xfetch/
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── commands/              # Command implementations
│   │   ├── user.ts
│   │   ├── tweets.ts
│   │   ├── search.ts
│   │   ├── timeline.ts
│   │   └── ...
│   ├── lib/
│   │   ├── client/            # Twitter client modules (mixin-based)
│   │   │   ├── base.ts        # Base client with auth
│   │   │   ├── users.ts
│   │   │   ├── tweets.ts
│   │   │   ├── search.ts
│   │   │   ├── timelines.ts
│   │   │   └── ...
│   │   ├── auth/
│   │   │   ├── cookies.ts     # Multi-browser cookie extraction
│   │   │   ├── session.ts     # Session management
│   │   │   └── pool.ts        # Session pool with rate tracking
│   │   ├── query-ids/
│   │   │   ├── fetcher.ts     # Auto-fetch from X bundles
│   │   │   ├── cache.ts       # Local cache with TTL
│   │   │   └── fallbacks.ts   # Hardcoded fallbacks
│   │   ├── anti-detect/
│   │   │   ├── transaction.ts # X-Client-Transaction-Id generation
│   │   │   ├── timing.ts      # Request jitter
│   │   │   └── fingerprint.ts # Feature flags
│   │   ├── output/
│   │   │   ├── json.ts
│   │   │   ├── csv.ts
│   │   │   ├── sqlite.ts
│   │   │   └── jsonl.ts
│   │   ├── pagination.ts      # Cursor-based with resume
│   │   ├── rate-limit.ts      # Per-endpoint tracking
│   │   └── proxy.ts           # Proxy rotation
│   └── types/
│       └── twitter.ts         # TypeScript types for API responses
├── package.json
├── tsconfig.json
└── README.md
```

## Core Features

### 1. Authentication (P0)

**Cookie Sources:**
- Chrome (default profile + named profiles)
- Firefox
- Safari
- Arc (Chromium-based)
- Brave
- Direct cookie input (--auth-token, --ct0)

```bash
xfetch auth check              # Show active auth source
xfetch auth extract --browser chrome --profile "Default"
```

### 2. Query ID Management (P0)

Auto-refresh from X's client bundles:
```bash
xfetch query-ids --refresh     # Fetch latest from X
xfetch query-ids --list        # Show cached IDs
```

Fallback chain:
1. Local cache (~/.config/xfetch/query-ids.json)
2. Fetch from X's main.js bundle
3. Hardcoded fallbacks (updated with releases)

### 3. Commands

**User Data:**
```bash
xfetch user @handle            # Profile info
xfetch user 12345678           # By ID
xfetch followers @handle -n 100
xfetch following @handle -n 100
```

**Tweets:**
```bash
xfetch tweets @handle -n 50    # User timeline
xfetch tweet <url-or-id>       # Single tweet
xfetch thread <url-or-id>      # Full thread
xfetch replies <url-or-id>     # Replies to tweet
```

**Search:**
```bash
xfetch search "query" -n 100
xfetch search "from:handle since:2024-01-01"
xfetch search "query" --type top|latest|people|photos|videos
```

**Timelines:**
```bash
xfetch home                    # Home timeline (requires auth)
xfetch home --following        # Chronological following
xfetch bookmarks -n 50
xfetch likes @handle -n 50
```

**Lists:**
```bash
xfetch lists @handle           # User's lists
xfetch list <id> -n 100        # List timeline
```

### 4. Output Formats (P1)

```bash
xfetch tweets @handle --format json      # Default
xfetch tweets @handle --format jsonl     # Line-delimited JSON
xfetch tweets @handle --format csv       # CSV with headers
xfetch tweets @handle --format sqlite --db tweets.db  # SQLite database
```

### 5. Pagination & Resume (P0)

```bash
xfetch tweets @handle --all              # Fetch all pages
xfetch tweets @handle --max-pages 10     # Limit pages
xfetch tweets @handle --cursor <cursor>  # Resume from cursor
xfetch tweets @handle --delay 1000       # Delay between pages (ms)
```

Resume file support:
```bash
xfetch tweets @handle --all --resume tweets-resume.json
# Interrupted? Re-run same command to continue
```

### 6. Rate Limit Handling (P0)

Per-endpoint tracking via response headers:
- `x-rate-limit-limit`
- `x-rate-limit-remaining`
- `x-rate-limit-reset`

Automatic backoff when approaching limits.

### 7. Session Pool (P1)

For high-volume scraping:
```bash
xfetch config sessions add session1.json
xfetch config sessions add session2.json
xfetch search "query" --pool              # Use session pool
```

Features:
- Random session selection
- Per-session rate tracking
- Auto-rotation on limit
- 24hr cooldown on hard limits

### 8. Proxy Support (P1)

```bash
xfetch tweets @handle --proxy http://user:pass@host:port
xfetch tweets @handle --proxy-file proxies.txt  # Rotation
```

### 9. Anti-Detection (P0)

**Transaction ID Generation:**
Mimics X's client-side transaction ID format for requests.

**Request Timing:**
Configurable jitter to avoid perfect intervals.

**Feature Flags:**
Current feature flags included in all requests.

## Configuration

`~/.config/xfetch/config.json`:
```json
{
  "cookieSource": "chrome",
  "chromeProfile": "Default",
  "defaultFormat": "json",
  "timeoutMs": 30000,
  "delayMs": 500,
  "jitterMs": 200,
  "proxy": null
}
```

## Installation

```bash
# npm
npm install -g xfetch

# pnpm
pnpm add -g xfetch

# bun
bun add -g xfetch

# One-shot (no install)
bunx xfetch tweets @handle
npx xfetch tweets @handle
```

## Differences from bird

| Feature | bird | xfetch |
|---------|------|--------|
| Query ID auto-refresh | Manual refresh | Auto from X bundles |
| Output formats | JSON only | JSON, JSONL, CSV, SQLite |
| Session pool | No | Yes |
| Proxy rotation | No | Yes |
| Resume pagination | Cursor only | Resume file support |
| Rate limit tracking | Basic | Per-endpoint + backoff |
| Transaction IDs | No | Yes (anti-detection) |

## Research Sources

Built from findings of 4 parallel research tracks:
1. GraphQL API deep dive (endpoints, headers, auth)
2. Nitter/alternative frontend analysis (session pools, rate limiting)
3. Browser automation research (stealth, cookie extraction)
4. Existing tools analysis (bird, snscrape, twint, twikit, rettiwt-api)

## License

MIT

## Credits

- Original bird CLI by @steipete
- LXGIC Studios (@lxgicstudios)

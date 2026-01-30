# xfetch 🚀

> Fast X/Twitter CLI scraper. No API keys. Just cookies and go.

[![npm version](https://img.shields.io/npm/v/xfetch.svg)](https://www.npmjs.com/package/xfetch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔐 **Cookie-based auth** - Extract from Chrome, Firefox, Safari, Arc, Brave
- 🔄 **Auto-refresh query IDs** - Survives X frontend deployments
- 📊 **Multi-format output** - JSON, JSONL, CSV, SQLite
- ⚡ **Session pooling** - High-volume scraping with rate limit awareness
- 🛡️ **Anti-detection** - Transaction IDs, request jitter, feature flags
- 🔁 **Resumable pagination** - Pick up where you left off
- 🌐 **Proxy support** - Rotation for residential IPs

## Install

```bash
# npm
npm install -g @lxgic/xfetch

# pnpm
pnpm add -g @lxgic/xfetch

# bun (recommended)
bun add -g @lxgic/xfetch

# One-shot (no install)
bunx @lxgic/xfetch tweets @elonmusk
npx @lxgic/xfetch tweets @elonmusk
```

## Quick Start

```bash
# Check auth status
xfetch auth check

# Get user profile
xfetch user @elonmusk

# Fetch tweets
xfetch tweets @elonmusk -n 50

# Search
xfetch search "AI agents" -n 100

# Export to CSV
xfetch tweets @elonmusk -n 100 --format csv > tweets.csv

# Export to SQLite
xfetch tweets @elonmusk --all --format sqlite --db tweets.db
```

## Commands

### Authentication

```bash
xfetch auth check                        # Show active auth
xfetch auth extract --browser chrome     # Extract cookies
```

### Users

```bash
xfetch user @handle                      # Profile by handle
xfetch user 12345678                     # Profile by ID
xfetch followers @handle -n 100          # Followers list
xfetch following @handle -n 100          # Following list
```

### Tweets

```bash
xfetch tweets @handle -n 50              # User timeline
xfetch tweet <url-or-id>                 # Single tweet
xfetch thread <url-or-id>                # Full thread
xfetch replies <url-or-id>               # Replies to tweet
```

### Search

```bash
xfetch search "query" -n 100             # Basic search
xfetch search "from:handle since:2024-01-01"  # Advanced
xfetch search "query" --type latest      # Latest tweets
```

### Timelines

```bash
xfetch home                              # Home timeline
xfetch home --following                  # Chronological
xfetch bookmarks -n 50                   # Your bookmarks
xfetch likes @handle -n 50               # User's likes
```

### Lists

```bash
xfetch lists @handle                     # User's lists
xfetch list <id> -n 100                  # List timeline
```

## Output Formats

```bash
--format json     # Default, pretty printed
--format jsonl    # Line-delimited JSON (streaming)
--format csv      # CSV with headers
--format sqlite   # SQLite database (use with --db)
```

## Pagination

```bash
xfetch tweets @handle --all              # All pages
xfetch tweets @handle --max-pages 10     # Limit pages
xfetch tweets @handle --cursor <cursor>  # Resume
xfetch tweets @handle --delay 1000       # Delay (ms)

# Resume support
xfetch tweets @handle --all --resume state.json
```

## Configuration

Config file: `~/.config/xfetch/config.json`

```json
{
  "cookieSource": "chrome",
  "chromeProfile": "Default",
  "defaultFormat": "json",
  "timeoutMs": 30000,
  "delayMs": 500
}
```

## Advanced

### Session Pool

For high-volume scraping with multiple accounts:

```bash
xfetch config sessions add session1.json
xfetch config sessions add session2.json
xfetch search "query" --pool
```

### Proxy

```bash
xfetch tweets @handle --proxy http://user:pass@host:port
xfetch tweets @handle --proxy-file proxies.txt
```

### Query ID Management

```bash
xfetch query-ids --refresh    # Fetch latest
xfetch query-ids --list       # Show cached
```

## Why xfetch?

| Feature | xfetch | bird | snscrape |
|---------|--------|------|----------|
| Query ID auto-refresh | ✅ | ❌ | ❌ |
| Multi-format output | ✅ | ❌ | ✅ |
| Session pooling | ✅ | ❌ | ❌ |
| Proxy rotation | ✅ | ❌ | ❌ |
| Resume pagination | ✅ | Cursor | ❌ |
| Anti-detection | ✅ | ❌ | ❌ |
| Active maintenance | ✅ | ✅ | ⚠️ |

## License

MIT © [LXGIC Studios](https://lxgic.studio)

## Credits

- Research from nitter, bird, snscrape, twint, twikit, rettiwt-api
- Original bird CLI by [@steipete](https://github.com/steipete)

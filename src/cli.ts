#!/usr/bin/env node

import { Command } from 'commander';
import { version } from './lib/version.js';
import { registerUserCommands } from './commands/user.js';
import { registerTweetCommands } from './commands/tweets.js';
import { registerSearchCommands } from './commands/search.js';
import { registerTimelineCommands } from './commands/timeline.js';
import { registerAuthCommands } from './commands/auth.js';
import { registerQueryIdCommands } from './commands/query-ids.js';

const program = new Command();

program
  .name('xfetch')
  .description('Fast X/Twitter CLI scraper. No API keys. Just cookies and go.')
  .version(version, '-v, --version');

// Global options
program
  .option('--auth-token <token>', 'Set auth_token cookie directly')
  .option('--ct0 <token>', 'Set ct0 cookie directly')
  .option('--cookie-source <source>', 'Cookie source (chrome, firefox, safari, arc, brave)')
  .option('--chrome-profile <name>', 'Chrome profile name')
  .option('--format <format>', 'Output format (json, jsonl, csv, sqlite)', 'json')
  .option('--db <path>', 'SQLite database path (use with --format sqlite)')
  .option('--proxy <url>', 'Proxy URL')
  .option('--proxy-file <path>', 'Proxy rotation file')
  .option('--timeout <ms>', 'Request timeout in ms', '30000')
  .option('--delay <ms>', 'Delay between requests in ms', '500')
  .option('--no-color', 'Disable colored output')
  .option('--json', 'Output raw JSON (shorthand for --format json)')
  .option('--plain', 'Plain output, no formatting');

// Register command groups
registerAuthCommands(program);
registerUserCommands(program);
registerTweetCommands(program);
registerSearchCommands(program);
registerTimelineCommands(program);
registerQueryIdCommands(program);

// Parse and execute
program.parse();

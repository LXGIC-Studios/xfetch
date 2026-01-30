import { Command } from 'commander';
import chalk from 'chalk';
import { SessionManager } from '../lib/auth/session.js';
import { extractCookies, getAvailableBrowsers, createSessionFromTokens, getBrowserProfiles, type BrowserType } from '../lib/auth/cookies.js';

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command('auth')
    .description('Authentication commands');

  auth
    .command('check')
    .description('Check current authentication status')
    .action(async () => {
      const sessionManager = new SessionManager();
      const session = sessionManager.load();

      if (session && sessionManager.isValid(session)) {
        console.log(chalk.green('✓ Authenticated'));
        if (session.username) {
          console.log(`  Username: @${session.username}`);
        }
        console.log(`  Auth Token: ${session.authToken.slice(0, 10)}...`);
        console.log(`  CT0: ${session.ct0.slice(0, 10)}...`);
      } else {
        console.log(chalk.yellow('✗ Not authenticated'));
        console.log('');
        console.log('Available browsers:');
        const browsers = getAvailableBrowsers();
        browsers.forEach(b => console.log(`  - ${b}`));
        console.log('');
        console.log('Use: xfetch auth extract --browser <browser>');
        console.log('Or:  xfetch --auth-token <token> --ct0 <token> <command>');
      }
    });

  auth
    .command('extract')
    .description('Extract cookies from browser')
    .option('--browser <browser>', 'Browser to extract from', 'chrome')
    .option('--profile <profile>', 'Browser profile name', 'Default')
    .action(async (options) => {
      console.log(chalk.blue(`Extracting cookies from ${options.browser}...`));
      
      const session = await extractCookies({
        browser: options.browser,
        profile: options.profile,
      });

      if (session) {
        const sessionManager = new SessionManager();
        sessionManager.save(session);
        console.log(chalk.green('✓ Cookies extracted and saved'));
      } else {
        console.log(chalk.red('✗ Failed to extract cookies'));
      }
    });

  auth
    .command('set')
    .description('Set authentication tokens directly')
    .requiredOption('--auth-token <token>', 'auth_token cookie')
    .requiredOption('--ct0 <token>', 'ct0 cookie')
    .action(async (options) => {
      const session = createSessionFromTokens(options.authToken, options.ct0);
      const sessionManager = new SessionManager();
      sessionManager.save(session);
      console.log(chalk.green('✓ Authentication tokens saved'));
    });

  auth
    .command('clear')
    .description('Clear saved authentication')
    .action(async () => {
      const sessionManager = new SessionManager();
      sessionManager.clear();
      console.log(chalk.green('✓ Authentication cleared'));
    });

  auth
    .command('browsers')
    .description('List available browsers and their profiles')
    .action(async () => {
      const browsers = getAvailableBrowsers();
      
      if (browsers.length === 0) {
        console.log(chalk.yellow('No supported browsers found'));
        return;
      }

      console.log(chalk.blue('Available browsers:\n'));
      
      for (const browser of browsers) {
        const profiles = getBrowserProfiles(browser as BrowserType);
        console.log(chalk.green(`  ${browser}`));
        
        if (profiles.length > 0) {
          profiles.forEach(p => console.log(chalk.gray(`    - ${p}`)));
        } else {
          console.log(chalk.gray('    (no profiles with cookies found)'));
        }
        console.log('');
      }
      
      console.log('Usage: xfetch auth extract --browser <browser> --profile <profile>');
    });
}

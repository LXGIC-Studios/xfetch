import { Command } from 'commander';
import chalk from 'chalk';
import { getClient, outputResult, executePaginated, type PaginatedCommandOptions } from './shared.js';
import { extractListId } from '../lib/client/lists.js';

export function registerListCommands(program: Command): void {
  // Get user's lists
  program
    .command('lists <handle>')
    .description('Get lists owned by a user')
    .option('-n, --count <count>', 'Number of lists to fetch', '100')
    .action(async (handle, options, command) => {
      const globalOpts = command.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        const count = parseInt(options.count || '100');
        const user = await client.getUser(handle);
        const result = await client.getUserLists(user.restId, count);
        
        outputResult(result.items, globalOpts);
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  // Get list details
  program
    .command('list <list-id-or-url>')
    .description('Get list details by ID or URL')
    .action(async (listIdOrUrl, options, command) => {
      const globalOpts = command.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        const listId = extractListId(listIdOrUrl);
        if (!listId) {
          console.error(chalk.red('Invalid list ID or URL. Expected numeric ID or https://x.com/i/lists/<id>'));
          process.exit(1);
        }

        const list = await client.getList(listId);
        outputResult(list, globalOpts);
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  // Get list members
  program
    .command('list-members <list-id-or-url>')
    .description('Get members of a list')
    .option('-n, --count <count>', 'Number of members per page', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all pages')
    .option('--max-pages <pages>', 'Maximum pages to fetch')
    .option('--resume <file>', 'Resume file for cursor state')
    .option('--delay <ms>', 'Delay between pages', '1000')
    .action(async (listIdOrUrl, options: PaginatedCommandOptions, command) => {
      const globalOpts = command.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        const listId = extractListId(listIdOrUrl);
        if (!listId) {
          console.error(chalk.red('Invalid list ID or URL. Expected numeric ID or https://x.com/i/lists/<id>'));
          process.exit(1);
        }

        const count = parseInt(options.count || '20');

        await executePaginated(
          (cursor) => client.getListMembers(listId, count, cursor),
          options,
          globalOpts
        );
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  // Get list tweets
  program
    .command('list-tweets <list-id-or-url>')
    .description('Get tweets from a list timeline')
    .option('-n, --count <count>', 'Number of tweets per page', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all pages')
    .option('--max-pages <pages>', 'Maximum pages to fetch')
    .option('--resume <file>', 'Resume file for cursor state')
    .option('--delay <ms>', 'Delay between pages', '1000')
    .action(async (listIdOrUrl, options: PaginatedCommandOptions, command) => {
      const globalOpts = command.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        const listId = extractListId(listIdOrUrl);
        if (!listId) {
          console.error(chalk.red('Invalid list ID or URL. Expected numeric ID or https://x.com/i/lists/<id>'));
          process.exit(1);
        }

        const count = parseInt(options.count || '20');

        await executePaginated(
          (cursor) => client.getListTweets(listId, count, cursor),
          options,
          globalOpts
        );
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

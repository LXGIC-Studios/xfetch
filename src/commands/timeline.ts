import { Command } from 'commander';
import chalk from 'chalk';
import { getClient, outputResult, executePaginated, type PaginatedCommandOptions } from './shared.js';

export function registerTimelineCommands(program: Command): void {
  program
    .command('home')
    .description('Get home timeline')
    .option('-n, --count <count>', 'Number of results per page', '20')
    .option('--following', 'Chronological following timeline')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all pages')
    .option('--max-pages <pages>', 'Maximum pages to fetch')
    .option('--resume <file>', 'Resume file for cursor state')
    .option('--delay <ms>', 'Delay between pages', '1000')
    .action(async (options: PaginatedCommandOptions & { following?: boolean }, command) => {
      const globalOpts = command.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        const count = parseInt(options.count || '20');
        const fetchFn = options.following
          ? (cursor?: string) => client.getHomeLatestTimeline(count, cursor)
          : (cursor?: string) => client.getHomeTimeline(count, cursor);

        await executePaginated(fetchFn, options, globalOpts);
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('bookmarks')
    .description('Get your bookmarks')
    .option('-n, --count <count>', 'Number of results per page', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all pages')
    .option('--max-pages <pages>', 'Maximum pages to fetch')
    .option('--resume <file>', 'Resume file for cursor state')
    .option('--delay <ms>', 'Delay between pages', '1000')
    .action(async (options: PaginatedCommandOptions, command) => {
      const globalOpts = command.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        const count = parseInt(options.count || '20');

        await executePaginated(
          (cursor) => client.getBookmarks(count, cursor),
          options,
          globalOpts
        );
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('likes <handle>')
    .description('Get user likes')
    .option('-n, --count <count>', 'Number of results per page', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all pages')
    .option('--max-pages <pages>', 'Maximum pages to fetch')
    .option('--resume <file>', 'Resume file for cursor state')
    .option('--delay <ms>', 'Delay between pages', '1000')
    .action(async (handle, options: PaginatedCommandOptions, command) => {
      const globalOpts = command.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        const count = parseInt(options.count || '20');
        const user = await client.getUser(handle);

        await executePaginated(
          (cursor) => client.getLikes(user.restId, count, cursor),
          options,
          globalOpts
        );
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

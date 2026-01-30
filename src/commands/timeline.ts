import { Command } from 'commander';
import chalk from 'chalk';
import { getClient, outputResult } from './shared.js';

export function registerTimelineCommands(program: Command): void {
  program
    .command('home')
    .description('Get home timeline')
    .option('-n, --count <count>', 'Number of results', '20')
    .option('--following', 'Chronological following timeline')
    .option('--cursor <cursor>', 'Pagination cursor')
    .action(async (options, command) => {
      const client = await getClient(command.parent?.opts());
      
      try {
        const fetchFn = options.following
          ? client.getHomeLatestTimeline.bind(client)
          : client.getHomeTimeline.bind(client);
        
        const result = await fetchFn(parseInt(options.count), options.cursor);
        outputResult(result, command.parent?.opts());
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('bookmarks')
    .description('Get your bookmarks')
    .option('-n, --count <count>', 'Number of results', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all pages')
    .action(async (options, command) => {
      const client = await getClient(command.parent?.opts());
      
      try {
        const result = await client.getBookmarks(parseInt(options.count), options.cursor);
        outputResult(result, command.parent?.opts());
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('likes <handle>')
    .description('Get user likes')
    .option('-n, --count <count>', 'Number of results', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all pages')
    .action(async (handle, options, command) => {
      const client = await getClient(command.parent?.opts());
      
      try {
        const user = await client.getUser(handle);
        const result = await client.getLikes(user.restId, parseInt(options.count), options.cursor);
        outputResult(result, command.parent?.opts());
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

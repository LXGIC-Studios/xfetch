import { Command } from 'commander';
import chalk from 'chalk';
import { getClient, outputResult, executePaginated, type PaginatedCommandOptions } from './shared.js';

export function registerUserCommands(program: Command): void {
  program
    .command('user <handle>')
    .description('Get user profile by handle or ID')
    .action(async (handle, options, command) => {
      const globalOpts = command.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        const isId = /^\d+$/.test(handle);
        const user = isId 
          ? await client.getUserById(handle)
          : await client.getUser(handle);
        
        outputResult(user, globalOpts);
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('followers <handle>')
    .description('Get user followers')
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
          (cursor) => client.getFollowers(user.restId, count, cursor),
          options,
          globalOpts
        );
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('following <handle>')
    .description('Get users that handle follows')
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
          (cursor) => client.getFollowing(user.restId, count, cursor),
          options,
          globalOpts
        );
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

}

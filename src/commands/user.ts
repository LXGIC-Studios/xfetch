import { Command } from 'commander';
import chalk from 'chalk';
import { getClient, outputResult } from './shared.js';

export function registerUserCommands(program: Command): void {
  program
    .command('user <handle>')
    .description('Get user profile by handle or ID')
    .action(async (handle, options, command) => {
      const client = await getClient(command.parent?.opts());
      
      try {
        const isId = /^\d+$/.test(handle);
        const user = isId 
          ? await client.getUserById(handle)
          : await client.getUser(handle);
        
        outputResult(user, command.parent?.opts());
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('followers <handle>')
    .description('Get user followers')
    .option('-n, --count <count>', 'Number of results', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all pages')
    .action(async (handle, options, command) => {
      const client = await getClient(command.parent?.opts());
      
      try {
        const user = await client.getUser(handle);
        const result = await client.getFollowers(user.restId, parseInt(options.count), options.cursor);
        outputResult(result, command.parent?.opts());
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('following <handle>')
    .description('Get users that handle follows')
    .option('-n, --count <count>', 'Number of results', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all pages')
    .action(async (handle, options, command) => {
      const client = await getClient(command.parent?.opts());
      
      try {
        const user = await client.getUser(handle);
        const result = await client.getFollowing(user.restId, parseInt(options.count), options.cursor);
        outputResult(result, command.parent?.opts());
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

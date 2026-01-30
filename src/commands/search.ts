import { Command } from 'commander';
import chalk from 'chalk';
import { getClient, outputResult } from './shared.js';

export function registerSearchCommands(program: Command): void {
  program
    .command('search <query>')
    .description('Search tweets')
    .option('-n, --count <count>', 'Number of results', '20')
    .option('--type <type>', 'Search type (top, latest, people, photos, videos)', 'top')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all pages')
    .option('--max-pages <pages>', 'Maximum pages to fetch')
    .option('--delay <ms>', 'Delay between pages', '1000')
    .action(async (query, options, command) => {
      const client = await getClient(command.parent?.opts());
      
      try {
        const result = await client.search(query, {
          type: options.type,
          count: parseInt(options.count),
          cursor: options.cursor,
        });
        
        outputResult(result, command.parent?.opts());
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

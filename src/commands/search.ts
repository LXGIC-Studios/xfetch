import { Command } from 'commander';
import chalk from 'chalk';
import { getClient, outputResult, executePaginated, type PaginatedCommandOptions } from './shared.js';

export function registerSearchCommands(program: Command): void {
  program
    .command('search <query>')
    .description('Search tweets')
    .option('-n, --count <count>', 'Number of results per page', '20')
    .option('--type <type>', 'Search type (top, latest, people, photos, videos)', 'top')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all pages')
    .option('--max-pages <pages>', 'Maximum pages to fetch')
    .option('--resume <file>', 'Resume file for cursor state')
    .option('--delay <ms>', 'Delay between pages', '1000')
    .action(async (query, options: PaginatedCommandOptions & { type?: string }, command) => {
      const globalOpts = command.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        const count = parseInt(options.count || '20');
        const searchType = options.type || 'top';

        await executePaginated(
          (cursor) => client.search(query, {
            type: searchType as any,
            count,
            cursor,
          }),
          options,
          globalOpts
        );
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

import { Command } from 'commander';
import chalk from 'chalk';
import { QueryIdManager } from '../lib/query-ids/index.js';

export function registerQueryIdCommands(program: Command): void {
  const queryIds = program
    .command('query-ids')
    .description('Manage GraphQL query IDs');

  queryIds
    .command('list')
    .description('List cached query IDs')
    .action(async () => {
      const manager = new QueryIdManager();
      const ids = manager.list();
      
      console.log(chalk.blue('Cached Query IDs:'));
      console.log('');
      
      const sorted = Object.entries(ids).sort((a, b) => a[0].localeCompare(b[0]));
      for (const [name, id] of sorted) {
        console.log(`  ${chalk.cyan(name)}: ${id}`);
      }
    });

  queryIds
    .command('refresh')
    .alias('update')
    .description('Refresh query IDs from X')
    .action(async () => {
      const manager = new QueryIdManager();
      
      console.log(chalk.blue('Fetching query IDs from X...'));
      
      const ids = await manager.refresh();
      const count = Object.keys(ids).length;
      
      console.log(chalk.green(`✓ Cached ${count} query IDs`));
    });
}

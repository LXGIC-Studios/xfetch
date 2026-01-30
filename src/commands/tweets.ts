import { Command } from 'commander';
import chalk from 'chalk';
import { getClient, outputResult, extractTweetId, executePaginated, type PaginatedCommandOptions } from './shared.js';

export function registerTweetCommands(program: Command): void {
  program
    .command('tweet <urlOrId>')
    .description('Get a single tweet by URL or ID')
    .action(async (urlOrId, options, command) => {
      const globalOpts = command.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        const tweetId = extractTweetId(urlOrId);
        const tweet = await client.getTweet(tweetId);
        outputResult(tweet, globalOpts);
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('tweets <handle>')
    .description('Get tweets from a user')
    .option('-n, --count <count>', 'Number of results per page', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all pages')
    .option('--max-pages <pages>', 'Maximum pages to fetch')
    .option('--resume <file>', 'Resume file for cursor state')
    .option('--delay <ms>', 'Delay between pages', '1000')
    .option('--replies', 'Include replies')
    .action(async (handle, options: PaginatedCommandOptions & { replies?: boolean }, command) => {
      const globalOpts = command.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        const count = parseInt(options.count || '20');
        const user = await client.getUser(handle);

        const fetchFn = options.replies
          ? (cursor?: string) => client.getUserTweetsAndReplies(user.restId, count, cursor)
          : (cursor?: string) => client.getUserTweets(user.restId, count, cursor);

        await executePaginated(fetchFn, options, globalOpts);
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('thread <urlOrId>')
    .description('Get full thread/conversation')
    .action(async (urlOrId, options, command) => {
      const globalOpts = command.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        const tweetId = extractTweetId(urlOrId);
        const tweets = await client.getThread(tweetId);
        outputResult(tweets, globalOpts);
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

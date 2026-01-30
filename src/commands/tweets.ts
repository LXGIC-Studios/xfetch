import { Command } from 'commander';
import chalk from 'chalk';
import { getClient, outputResult, extractTweetId } from './shared.js';

export function registerTweetCommands(program: Command): void {
  program
    .command('tweet <urlOrId>')
    .description('Get a single tweet by URL or ID')
    .action(async (urlOrId, options, command) => {
      const client = await getClient(command.parent?.opts());
      
      try {
        const tweetId = extractTweetId(urlOrId);
        const tweet = await client.getTweet(tweetId);
        outputResult(tweet, command.parent?.opts());
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('tweets <handle>')
    .description('Get tweets from a user')
    .option('-n, --count <count>', 'Number of results', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all pages')
    .option('--max-pages <pages>', 'Maximum pages to fetch')
    .option('--delay <ms>', 'Delay between pages', '1000')
    .option('--replies', 'Include replies')
    .action(async (handle, options, command) => {
      const client = await getClient(command.parent?.opts());
      
      try {
        const user = await client.getUser(handle);
        const fetchFn = options.replies
          ? client.getUserTweetsAndReplies.bind(client)
          : client.getUserTweets.bind(client);
        
        const result = await fetchFn(user.restId, parseInt(options.count), options.cursor);
        outputResult(result, command.parent?.opts());
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  program
    .command('thread <urlOrId>')
    .description('Get full thread/conversation')
    .action(async (urlOrId, options, command) => {
      const client = await getClient(command.parent?.opts());
      
      try {
        const tweetId = extractTweetId(urlOrId);
        const tweets = await client.getThread(tweetId);
        outputResult(tweets, command.parent?.opts());
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

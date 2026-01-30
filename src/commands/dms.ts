import { Command } from 'commander';
import chalk from 'chalk';
import { getClient, outputResult, executePaginated, type PaginatedCommandOptions } from './shared.js';
import type { PaginatedResult } from '../types/twitter.js';
import type { DMConversation, DMMessage } from '../types/dm.js';

export function registerDMCommands(program: Command): void {
  const dms = program
    .command('dms')
    .description('Direct Messages commands');

  // List DM conversations (inbox)
  dms
    .command('inbox')
    .alias('list')
    .description('List DM conversations (inbox)')
    .option('-n, --count <count>', 'Number of conversations to fetch', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--all', 'Fetch all conversations')
    .option('--max-pages <pages>', 'Maximum pages to fetch')
    .option('--delay <ms>', 'Delay between pages', '1000')
    .action(async (options: PaginatedCommandOptions, command) => {
      const globalOpts = command.parent?.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        // For single page fetch
        if (!options.all && !options.maxPages) {
          const result = await client.getDMInbox(options.cursor);
          
          // Format output
          const output = {
            conversations: result.conversations,
            cursor: result.cursor,
            hasMore: result.hasMore,
            count: result.conversations.length,
          };
          
          outputResult(output, globalOpts);
          return;
        }

        // Multi-page fetch
        const fetchFn = async (cursor?: string): Promise<PaginatedResult<DMConversation>> => {
          const result = await client.getDMInbox(cursor);
          return {
            items: result.conversations,
            cursor: result.cursor,
            hasMore: result.hasMore,
          };
        };

        await executePaginated(fetchFn, options, globalOpts);
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  // Get messages from a specific conversation
  dms
    .command('conversation <conversation_id>')
    .alias('conv')
    .description('Get messages from a DM conversation')
    .option('-n, --count <count>', 'Number of messages to fetch', '50')
    .option('--cursor <cursor>', 'Pagination cursor (max_id for older messages)')
    .option('--all', 'Fetch all messages')
    .option('--max-pages <pages>', 'Maximum pages to fetch')
    .option('--delay <ms>', 'Delay between pages', '1000')
    .action(async (conversationId: string, options: PaginatedCommandOptions, command) => {
      const globalOpts = command.parent?.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        // For single page fetch
        if (!options.all && !options.maxPages) {
          const result = await client.getDMConversation(conversationId, options.cursor);
          
          // Format output
          const output = {
            conversationId: result.conversationId,
            messages: result.messages,
            cursor: result.cursor,
            hasMore: result.hasMore,
            count: result.messages.length,
          };
          
          outputResult(output, globalOpts);
          return;
        }

        // Multi-page fetch
        const fetchFn = async (cursor?: string): Promise<PaginatedResult<DMMessage>> => {
          const result = await client.getDMConversation(conversationId, cursor);
          return {
            items: result.messages,
            cursor: result.cursor,
            hasMore: result.hasMore,
          };
        };

        await executePaginated(fetchFn, options, globalOpts);
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  // Shortcut: xfetch dms <conversation_id> shows messages directly
  // This is handled by checking if the first arg looks like a conversation ID
  dms
    .argument('[conversation_id]', 'Conversation ID to fetch messages from')
    .action(async (conversationId: string | undefined, options: any, command) => {
      const globalOpts = command.parent?.opts() || {};
      const client = await getClient(globalOpts);
      
      try {
        if (conversationId) {
          // If a conversation ID is provided, show messages
          const result = await client.getDMConversation(conversationId);
          
          const output = {
            conversationId: result.conversationId,
            messages: result.messages,
            cursor: result.cursor,
            hasMore: result.hasMore,
            count: result.messages.length,
          };
          
          outputResult(output, globalOpts);
        } else {
          // If no conversation ID, show inbox
          const result = await client.getDMInbox();
          
          const output = {
            conversations: result.conversations,
            cursor: result.cursor,
            hasMore: result.hasMore,
            count: result.conversations.length,
          };
          
          outputResult(output, globalOpts);
        }
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

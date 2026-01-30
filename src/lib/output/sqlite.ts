/**
 * SQLite output formatter using better-sqlite3
 * Automatically creates tables and upserts data
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { Tweet, User } from '../../types/twitter.js';

export interface SqliteOptions {
  dbPath: string;
  tableName?: string;
}

type DataType = 'users' | 'tweets' | 'generic';

/**
 * Detect data type from structure
 */
function detectDataType(item: unknown): DataType {
  if (!item || typeof item !== 'object') return 'generic';
  
  const obj = item as Record<string, unknown>;
  
  // Tweet detection
  if ('text' in obj && 'replyCount' in obj && 'retweetCount' in obj) {
    return 'tweets';
  }
  
  // User detection
  if ('screenName' in obj && 'followersCount' in obj) {
    return 'users';
  }
  
  return 'generic';
}

/**
 * Extract items from various data structures
 */
function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.tweets)) return obj.tweets;
    if (Array.isArray(obj.users)) return obj.users;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.results)) return obj.results;
  }
  
  return [data];
}

/**
 * Create users table schema
 */
function createUsersTable(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      rest_id TEXT UNIQUE,
      name TEXT,
      screen_name TEXT,
      description TEXT,
      location TEXT,
      url TEXT,
      created_at TEXT,
      followers_count INTEGER,
      following_count INTEGER,
      tweet_count INTEGER,
      listed_count INTEGER,
      profile_image_url TEXT,
      profile_banner_url TEXT,
      verified INTEGER,
      is_blue_verified INTEGER,
      protected INTEGER,
      fetched_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_screen_name ON users(screen_name)`);
}

/**
 * Create tweets table schema
 */
function createTweetsTable(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tweets (
      id TEXT PRIMARY KEY,
      text TEXT,
      created_at TEXT,
      user_id TEXT,
      user_screen_name TEXT,
      reply_count INTEGER,
      retweet_count INTEGER,
      like_count INTEGER,
      quote_count INTEGER,
      view_count INTEGER,
      bookmark_count INTEGER,
      is_retweet INTEGER,
      is_quote INTEGER,
      is_reply INTEGER,
      media TEXT,
      quoted_tweet_id TEXT,
      in_reply_to_tweet_id TEXT,
      in_reply_to_user_id TEXT,
      conversation_id TEXT,
      lang TEXT,
      fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tweets_user_id ON tweets(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tweets_conversation_id ON tweets(conversation_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at)`);
}

/**
 * Create generic table for unknown data types
 */
function createGenericTable(db: DatabaseType, tableName: string, sample: Record<string, unknown>): void {
  const columns: string[] = ['id TEXT PRIMARY KEY'];
  
  for (const [key, value] of Object.entries(sample)) {
    if (key === 'id') continue;
    
    const colName = key.replace(/[^a-zA-Z0-9_]/g, '_');
    let colType = 'TEXT';
    
    if (typeof value === 'number') {
      colType = Number.isInteger(value) ? 'INTEGER' : 'REAL';
    } else if (typeof value === 'boolean') {
      colType = 'INTEGER';
    }
    
    columns.push(`${colName} ${colType}`);
  }
  
  columns.push('fetched_at TEXT DEFAULT CURRENT_TIMESTAMP');
  
  db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(', ')})`);
}

/**
 * Upsert a user record
 */
function upsertUser(db: DatabaseType, user: User): void {
  const stmt = db.prepare(`
    INSERT INTO users (
      id, rest_id, name, screen_name, description, location, url, created_at,
      followers_count, following_count, tweet_count, listed_count,
      profile_image_url, profile_banner_url, verified, is_blue_verified, protected
    ) VALUES (
      @id, @restId, @name, @screenName, @description, @location, @url, @createdAt,
      @followersCount, @followingCount, @tweetCount, @listedCount,
      @profileImageUrl, @profileBannerUrl, @verified, @isBlueVerified, @protected
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      screen_name = excluded.screen_name,
      description = excluded.description,
      location = excluded.location,
      url = excluded.url,
      followers_count = excluded.followers_count,
      following_count = excluded.following_count,
      tweet_count = excluded.tweet_count,
      listed_count = excluded.listed_count,
      profile_image_url = excluded.profile_image_url,
      profile_banner_url = excluded.profile_banner_url,
      verified = excluded.verified,
      is_blue_verified = excluded.is_blue_verified,
      protected = excluded.protected,
      fetched_at = CURRENT_TIMESTAMP
  `);
  
  stmt.run({
    id: user.id,
    restId: user.restId,
    name: user.name,
    screenName: user.screenName,
    description: user.description,
    location: user.location,
    url: user.url,
    createdAt: user.createdAt,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    tweetCount: user.tweetCount,
    listedCount: user.listedCount,
    profileImageUrl: user.profileImageUrl,
    profileBannerUrl: user.profileBannerUrl || null,
    verified: user.verified ? 1 : 0,
    isBlueVerified: user.isBlueVerified ? 1 : 0,
    protected: user.protected ? 1 : 0,
  });
}

/**
 * Upsert a tweet record
 */
function upsertTweet(db: DatabaseType, tweet: Tweet): void {
  // First upsert the user
  if (tweet.user) {
    upsertUser(db, tweet.user);
  }
  
  const stmt = db.prepare(`
    INSERT INTO tweets (
      id, text, created_at, user_id, user_screen_name,
      reply_count, retweet_count, like_count, quote_count, view_count, bookmark_count,
      is_retweet, is_quote, is_reply, media, quoted_tweet_id,
      in_reply_to_tweet_id, in_reply_to_user_id, conversation_id, lang
    ) VALUES (
      @id, @text, @createdAt, @userId, @userScreenName,
      @replyCount, @retweetCount, @likeCount, @quoteCount, @viewCount, @bookmarkCount,
      @isRetweet, @isQuote, @isReply, @media, @quotedTweetId,
      @inReplyToTweetId, @inReplyToUserId, @conversationId, @lang
    )
    ON CONFLICT(id) DO UPDATE SET
      text = excluded.text,
      reply_count = excluded.reply_count,
      retweet_count = excluded.retweet_count,
      like_count = excluded.like_count,
      quote_count = excluded.quote_count,
      view_count = excluded.view_count,
      bookmark_count = excluded.bookmark_count,
      fetched_at = CURRENT_TIMESTAMP
  `);
  
  stmt.run({
    id: tweet.id,
    text: tweet.text,
    createdAt: tweet.createdAt,
    userId: tweet.user?.id || null,
    userScreenName: tweet.user?.screenName || null,
    replyCount: tweet.replyCount,
    retweetCount: tweet.retweetCount,
    likeCount: tweet.likeCount,
    quoteCount: tweet.quoteCount,
    viewCount: tweet.viewCount || null,
    bookmarkCount: tweet.bookmarkCount || null,
    isRetweet: tweet.isRetweet ? 1 : 0,
    isQuote: tweet.isQuote ? 1 : 0,
    isReply: tweet.isReply ? 1 : 0,
    media: tweet.media ? JSON.stringify(tweet.media) : null,
    quotedTweetId: tweet.quotedTweet?.id || null,
    inReplyToTweetId: tweet.inReplyToTweetId || null,
    inReplyToUserId: tweet.inReplyToUserId || null,
    conversationId: tweet.conversationId,
    lang: tweet.lang,
  });
  
  // Recursively handle quoted tweet
  if (tweet.quotedTweet) {
    upsertTweet(db, tweet.quotedTweet);
  }
}

/**
 * Upsert generic data
 */
function upsertGeneric(db: DatabaseType, tableName: string, item: Record<string, unknown>): void {
  const keys = Object.keys(item);
  const columns = keys.map(k => k.replace(/[^a-zA-Z0-9_]/g, '_'));
  const placeholders = keys.map(k => `@${k}`);
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
  `);
  
  const params: Record<string, unknown> = {};
  for (const key of keys) {
    let value = item[key];
    if (typeof value === 'object' && value !== null) {
      value = JSON.stringify(value);
    } else if (typeof value === 'boolean') {
      value = value ? 1 : 0;
    }
    params[key] = value;
  }
  
  stmt.run(params);
}

export function outputSqlite(data: unknown, options: SqliteOptions): { inserted: number; tableName: string } {
  const { dbPath, tableName: customTableName } = options;
  
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  const items = extractItems(data);
  
  if (items.length === 0) {
    db.close();
    return { inserted: 0, tableName: '' };
  }
  
  // Detect data type from first item
  const dataType = detectDataType(items[0]);
  const tableName = customTableName || dataType;
  
  // Create appropriate table
  switch (dataType) {
    case 'users':
      createUsersTable(db);
      break;
    case 'tweets':
      createTweetsTable(db);
      createUsersTable(db); // Tweets reference users
      break;
    default:
      createGenericTable(db, tableName, items[0] as Record<string, unknown>);
  }
  
  // Use transaction for bulk insert
  const insertMany = db.transaction((items: unknown[]) => {
    for (const item of items) {
      switch (dataType) {
        case 'users':
          upsertUser(db, item as User);
          break;
        case 'tweets':
          upsertTweet(db, item as Tweet);
          break;
        default:
          upsertGeneric(db, tableName, item as Record<string, unknown>);
      }
    }
  });
  
  insertMany(items);
  
  db.close();
  
  return { inserted: items.length, tableName };
}

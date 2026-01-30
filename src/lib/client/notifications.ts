import { request, ProxyAgent } from 'undici';
import { BaseClient } from './base.js';
import type { Tweet, PaginatedResult, User } from '../../types/twitter.js';
import { generateTransactionId } from '../anti-detect/transaction.js';

// Notification types
export type NotificationType = 'all' | 'mentions' | 'verified';

export interface Notification {
  id: string;
  timestampMs: string;
  icon: string;
  message?: string;
  url?: string;
  fromUsers: User[];
  targetTweets: Tweet[];
  type: string;
}

export interface NotificationResult {
  notifications: Notification[];
  tweets: Tweet[];
  cursor?: string;
  hasMore: boolean;
}

// Static bearer token (from Twitter web client)
const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

export class NotificationsMixin extends BaseClient {
  /**
   * Get all notifications
   */
  async getNotifications(count = 20, cursor?: string): Promise<PaginatedResult<Tweet>> {
    return this.fetchNotifications('all', count, cursor);
  }

  /**
   * Get only mention notifications
   */
  async getMentions(count = 20, cursor?: string): Promise<PaginatedResult<Tweet>> {
    return this.fetchNotifications('mentions', count, cursor);
  }

  /**
   * Get verified notifications (blue checkmark interactions)
   */
  async getVerifiedNotifications(count = 20, cursor?: string): Promise<PaginatedResult<Tweet>> {
    return this.fetchNotifications('verified', count, cursor);
  }

  /**
   * Fetch notifications from the URT REST endpoint
   */
  private async fetchNotifications(
    type: NotificationType,
    count: number,
    cursor?: string
  ): Promise<PaginatedResult<Tweet>> {
    const url = new URL(`https://x.com/i/api/2/notifications/${type}.json`);
    
    // Add query parameters
    url.searchParams.set('include_profile_interstitial_type', '1');
    url.searchParams.set('include_blocking', '1');
    url.searchParams.set('include_blocked_by', '1');
    url.searchParams.set('include_followed_by', '1');
    url.searchParams.set('include_want_retweets', '1');
    url.searchParams.set('include_mute_edge', '1');
    url.searchParams.set('include_can_dm', '1');
    url.searchParams.set('include_can_media_tag', '1');
    url.searchParams.set('include_ext_is_blue_verified', '1');
    url.searchParams.set('include_ext_verified_type', '1');
    url.searchParams.set('include_ext_profile_image_shape', '1');
    url.searchParams.set('skip_status', '1');
    url.searchParams.set('cards_platform', 'Web-12');
    url.searchParams.set('include_cards', '1');
    url.searchParams.set('include_ext_alt_text', 'true');
    url.searchParams.set('include_ext_limited_action_results', 'true');
    url.searchParams.set('include_quote_count', 'true');
    url.searchParams.set('include_reply_count', '1');
    url.searchParams.set('tweet_mode', 'extended');
    url.searchParams.set('include_ext_views', 'true');
    url.searchParams.set('include_entities', 'true');
    url.searchParams.set('include_user_entities', 'true');
    url.searchParams.set('include_ext_media_color', 'true');
    url.searchParams.set('include_ext_media_availability', 'true');
    url.searchParams.set('include_ext_sensitive_media_warning', 'true');
    url.searchParams.set('include_ext_trusted_friends_metadata', 'true');
    url.searchParams.set('send_error_codes', 'true');
    url.searchParams.set('simple_quoted_tweet', 'true');
    url.searchParams.set('count', count.toString());
    url.searchParams.set('ext', 'mediaStats,highlightedLabel,voiceInfo,birdwatchPivot,superFollowMetadata,unmentionInfo,editControl');
    
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    // Add jitter to avoid detection
    if (this.options.jitterMs) {
      await this.sleep(Math.random() * this.options.jitterMs);
    }

    const headers = this.getNotificationHeaders();
    headers['x-client-transaction-id'] = generateTransactionId();

    // Get proxy dispatcher if configured
    const dispatcher = this.getDispatcher();

    const response = await request(url.toString(), {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(this.options.timeoutMs!),
      dispatcher,
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Notification request failed with status ${response.statusCode}: ${body.slice(0, 200)}`);
    }

    const data = await response.body.json() as any;
    
    return this.parseNotificationResponse(data);
  }

  /**
   * Get headers for notification requests (similar to GraphQL but for REST)
   */
  private getNotificationHeaders(): Record<string, string> {
    return {
      'authorization': `Bearer ${BEARER_TOKEN}`,
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
      'x-csrf-token': this.session.ct0,
      'cookie': `auth_token=${this.session.authToken}; ct0=${this.session.ct0}`,
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'x-twitter-client-language': 'en',
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'referer': 'https://x.com/notifications',
    };
  }

  /**
   * Parse the URT notification response
   */
  private parseNotificationResponse(data: any): PaginatedResult<Tweet> {
    const tweets: Tweet[] = [];
    let nextCursor: string | undefined;

    // Parse global objects (tweets and users are stored separately in URT)
    const globalTweets = data.globalObjects?.tweets || {};
    const globalUsers = data.globalObjects?.users || {};

    // Build a user lookup map
    const userMap = new Map<string, User>();
    for (const [userId, userData] of Object.entries(globalUsers)) {
      const user = userData as any;
      userMap.set(userId, {
        id: userId,
        restId: userId,
        name: user.name,
        screenName: user.screen_name,
        description: user.description || '',
        location: user.location || '',
        url: user.url || '',
        createdAt: user.created_at,
        followersCount: user.followers_count,
        followingCount: user.friends_count,
        tweetCount: user.statuses_count,
        listedCount: user.listed_count,
        profileImageUrl: user.profile_image_url_https,
        profileBannerUrl: user.profile_banner_url,
        verified: user.verified || false,
        isBlueVerified: user.ext_is_blue_verified || user.is_blue_verified || false,
        protected: user.protected || false,
      });
    }

    // Parse tweets from global objects
    for (const [tweetId, tweetData] of Object.entries(globalTweets)) {
      const tweet = tweetData as any;
      const userId = tweet.user_id_str;
      const user = userMap.get(userId);

      if (user) {
        tweets.push({
          id: tweetId,
          text: tweet.full_text || tweet.text,
          createdAt: tweet.created_at,
          user,
          replyCount: tweet.reply_count || 0,
          retweetCount: tweet.retweet_count || 0,
          likeCount: tweet.favorite_count || 0,
          quoteCount: tweet.quote_count || 0,
          viewCount: tweet.ext_views?.count ? parseInt(tweet.ext_views.count) : undefined,
          bookmarkCount: tweet.bookmark_count,
          isRetweet: !!tweet.retweeted_status_id_str,
          isQuote: !!tweet.is_quote_status,
          isReply: !!tweet.in_reply_to_status_id_str,
          inReplyToTweetId: tweet.in_reply_to_status_id_str,
          inReplyToUserId: tweet.in_reply_to_user_id_str,
          conversationId: tweet.conversation_id_str,
          lang: tweet.lang,
        });
      }
    }

    // Find the cursor from timeline instructions
    const timeline = data.timeline || {};
    const instructions = timeline.instructions || [];
    
    for (const instruction of instructions) {
      if (instruction.addEntries?.entries) {
        for (const entry of instruction.addEntries.entries) {
          if (entry.content?.operation?.cursor?.cursorType === 'Bottom') {
            nextCursor = entry.content.operation.cursor.value;
          }
        }
      }
      // Also check for cursor in replaceEntry
      if (instruction.replaceEntry?.entry?.content?.operation?.cursor?.cursorType === 'Bottom') {
        nextCursor = instruction.replaceEntry.entry.content.operation.cursor.value;
      }
    }

    // Sort tweets by creation date (newest first)
    tweets.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return {
      items: tweets,
      cursor: nextCursor,
      hasMore: !!nextCursor,
    };
  }
}

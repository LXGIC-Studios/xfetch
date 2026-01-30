import { request } from 'undici';
import { QueryIdManager } from '../query-ids/index.js';
import { RateLimiter } from '../rate-limit.js';
import { generateTransactionId } from '../anti-detect/transaction.js';
import type { Session, ClientOptions, GraphQLResponse } from '../../types/twitter.js';

// Static bearer token (from Twitter web client)
const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

export class BaseClient {
  protected session: Session;
  protected queryIds: QueryIdManager;
  protected rateLimiter: RateLimiter;
  protected options: ClientOptions;

  constructor(session: Session, options: ClientOptions = {}) {
    this.session = session;
    this.options = {
      timeoutMs: 30000,
      delayMs: 500,
      jitterMs: 200,
      ...options,
    };
    this.queryIds = new QueryIdManager();
    this.rateLimiter = new RateLimiter();
  }

  protected getHeaders(): Record<string, string> {
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
    };
  }

  protected async graphql<T>(
    operationName: string,
    variables: Record<string, unknown>,
    features?: Record<string, boolean>
  ): Promise<T> {
    const queryId = await this.queryIds.get(operationName);
    
    const defaultFeatures = {
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      articles_preview_enabled: true,
      tweetypie_unmention_optimization_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      rweb_video_timestamps_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_enhance_cards_enabled: false,
    };

    const url = new URL(`https://x.com/i/api/graphql/${queryId}/${operationName}`);
    url.searchParams.set('variables', JSON.stringify(variables));
    url.searchParams.set('features', JSON.stringify(features || defaultFeatures));

    // Add jitter to avoid detection
    if (this.options.jitterMs) {
      await this.sleep(Math.random() * this.options.jitterMs);
    }

    // Check rate limits
    await this.rateLimiter.waitIfNeeded(operationName);

    const headers = this.getHeaders();
    headers['x-client-transaction-id'] = generateTransactionId();

    const response = await request(url.toString(), {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(this.options.timeoutMs!),
    });

    // Update rate limit tracking
    this.rateLimiter.update(operationName, {
      limit: parseInt(response.headers['x-rate-limit-limit'] as string) || 0,
      remaining: parseInt(response.headers['x-rate-limit-remaining'] as string) || 0,
      reset: parseInt(response.headers['x-rate-limit-reset'] as string) || 0,
    });

    const data = await response.body.json() as GraphQLResponse<T>;

    if (data.errors) {
      throw new Error(`GraphQL Error: ${data.errors.map(e => e.message).join(', ')}`);
    }

    return data.data;
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

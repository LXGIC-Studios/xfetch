// Session types
export interface Session {
  authToken: string;
  ct0: string;
  username?: string;
  userId?: string;
}

export interface ClientOptions {
  timeoutMs?: number;
  delayMs?: number;
  jitterMs?: number;
  proxy?: string;
  proxyFile?: string;
}

// GraphQL response types
export interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{
    message: string;
    code: number;
  }>;
}

// User types
export interface User {
  id: string;
  restId: string;
  name: string;
  screenName: string;
  description: string;
  location: string;
  url: string;
  createdAt: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
  listedCount: number;
  profileImageUrl: string;
  profileBannerUrl?: string;
  verified: boolean;
  isBlueVerified: boolean;
  protected: boolean;
}

export interface UserResult {
  user: {
    result: {
      __typename: string;
      id: string;
      rest_id: string;
      legacy: {
        name: string;
        screen_name: string;
        description: string;
        location: string;
        url: string;
        created_at: string;
        followers_count: number;
        friends_count: number;
        statuses_count: number;
        listed_count: number;
        profile_image_url_https: string;
        profile_banner_url?: string;
        verified: boolean;
        protected: boolean;
      };
      is_blue_verified: boolean;
    };
  };
}

// Tweet types
export interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  user: User;
  replyCount: number;
  retweetCount: number;
  likeCount: number;
  quoteCount: number;
  viewCount?: number;
  bookmarkCount?: number;
  isRetweet: boolean;
  isQuote: boolean;
  isReply: boolean;
  media?: TweetMedia[];
  quotedTweet?: Tweet;
  inReplyToTweetId?: string;
  inReplyToUserId?: string;
  conversationId: string;
  lang: string;
}

export interface TweetMedia {
  type: 'photo' | 'video' | 'animated_gif';
  url: string;
  width: number;
  height: number;
  altText?: string;
  duration?: number;
}

// Timeline types
export interface TimelineResponse {
  tweets: Tweet[];
  cursor?: string;
  hasMore: boolean;
}

// Search types
export interface SearchOptions {
  type?: 'top' | 'latest' | 'people' | 'photos' | 'videos';
  count?: number;
  cursor?: string;
}

// Rate limit types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

// Pagination types
export interface PaginationOptions {
  count?: number;
  cursor?: string;
  maxPages?: number;
  all?: boolean;
  delay?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  cursor?: string;
  hasMore: boolean;
}

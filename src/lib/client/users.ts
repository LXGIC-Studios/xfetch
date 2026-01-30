import { BaseClient } from './base.js';
import type { User, UserResult, PaginatedResult } from '../../types/twitter.js';

export class UserMixin extends BaseClient {
  async getUser(handle: string): Promise<User> {
    const screenName = handle.replace(/^@/, '');
    
    const data = await this.graphql<UserResult>('UserByScreenName', {
      screen_name: screenName,
      withSafetyModeUserFields: true,
    });

    return this.parseUser(data.user.result);
  }

  async getUserById(userId: string): Promise<User> {
    const data = await this.graphql<UserResult>('UserByRestId', {
      userId,
      withSafetyModeUserFields: true,
    });

    return this.parseUser(data.user.result);
  }

  async getFollowers(userId: string, count = 20, cursor?: string): Promise<PaginatedResult<User>> {
    const data = await this.graphql<any>('Followers', {
      userId,
      count,
      cursor,
      includePromotedContent: false,
    });

    return this.parseUserList(data);
  }

  async getFollowing(userId: string, count = 20, cursor?: string): Promise<PaginatedResult<User>> {
    const data = await this.graphql<any>('Following', {
      userId,
      count,
      cursor,
      includePromotedContent: false,
    });

    return this.parseUserList(data);
  }

  private parseUser(result: any): User {
    const legacy = result.legacy;
    return {
      id: result.id,
      restId: result.rest_id,
      name: legacy.name,
      screenName: legacy.screen_name,
      description: legacy.description,
      location: legacy.location,
      url: legacy.url,
      createdAt: legacy.created_at,
      followersCount: legacy.followers_count,
      followingCount: legacy.friends_count,
      tweetCount: legacy.statuses_count,
      listedCount: legacy.listed_count,
      profileImageUrl: legacy.profile_image_url_https,
      profileBannerUrl: legacy.profile_banner_url,
      verified: legacy.verified,
      isBlueVerified: result.is_blue_verified || false,
      protected: legacy.protected,
    };
  }

  private parseUserList(data: any): PaginatedResult<User> {
    const instructions = data?.user?.result?.timeline?.timeline?.instructions || [];
    const entries = instructions
      .find((i: any) => i.type === 'TimelineAddEntries')
      ?.entries || [];

    const users: User[] = [];
    let cursor: string | undefined;

    for (const entry of entries) {
      if (entry.content?.itemContent?.user_results?.result) {
        users.push(this.parseUser(entry.content.itemContent.user_results.result));
      }
      if (entry.content?.cursorType === 'Bottom') {
        cursor = entry.content.value;
      }
    }

    return {
      items: users,
      cursor,
      hasMore: !!cursor,
    };
  }
}

import { request, ProxyAgent } from 'undici';
import { BaseClient } from './base.js';
import { generateTransactionId } from '../anti-detect/transaction.js';
import type {
  DMConversation,
  DMMessage,
  DMParticipant,
  DMInboxResponse,
  DMConversationResponse,
  RawDMInboxResponse,
  RawDMConversationResponse,
  RawDMEntry,
  RawDMUser,
  RawDMConversation,
} from '../../types/dm.js';

const DM_API_BASE = 'https://x.com/i/api/1.1';

export class DMMixin extends BaseClient {
  /**
   * Fetch DM inbox (list of conversations)
   */
  async getDMInbox(cursor?: string): Promise<DMInboxResponse> {
    const url = new URL(`${DM_API_BASE}/dm/inbox_initial_state.json`);
    
    // Required query params
    url.searchParams.set('nsfw_filtering_enabled', 'false');
    url.searchParams.set('filter_low_quality', 'false');
    url.searchParams.set('include_quality', 'all');
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
    url.searchParams.set('dm_secret_conversations_enabled', 'false');
    url.searchParams.set('krs_registration_enabled', 'true');
    url.searchParams.set('cards_platform', 'Web-12');
    url.searchParams.set('include_cards', '1');
    url.searchParams.set('include_ext_alt_text', 'true');
    url.searchParams.set('include_ext_limited_action_results', 'true');
    url.searchParams.set('include_quote_count', 'true');
    url.searchParams.set('include_reply_count', '1');
    url.searchParams.set('tweet_mode', 'extended');
    url.searchParams.set('include_ext_views', 'true');
    url.searchParams.set('dm_users', 'true');
    url.searchParams.set('include_groups', 'true');
    url.searchParams.set('include_inbox_timelines', 'true');
    url.searchParams.set('include_ext_media_color', 'true');
    url.searchParams.set('supports_reactions', 'true');
    url.searchParams.set('include_ext_edit_control', 'true');
    url.searchParams.set('ext', 'mediaColor,altText,mediaStats,highlightedLabel,voiceInfo,birdwatchPivot,superFollowMetadata,unmentionInfo,editControl');
    
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const data = await this.dmRequest<RawDMInboxResponse>(url.toString());
    return this.parseDMInbox(data);
  }

  /**
   * Fetch messages from a specific conversation
   */
  async getDMConversation(conversationId: string, cursor?: string): Promise<DMConversationResponse> {
    const url = new URL(`${DM_API_BASE}/dm/conversation/${conversationId}.json`);
    
    // Required query params
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
    url.searchParams.set('dm_secret_conversations_enabled', 'false');
    url.searchParams.set('krs_registration_enabled', 'true');
    url.searchParams.set('cards_platform', 'Web-12');
    url.searchParams.set('include_cards', '1');
    url.searchParams.set('include_ext_alt_text', 'true');
    url.searchParams.set('include_ext_limited_action_results', 'true');
    url.searchParams.set('include_quote_count', 'true');
    url.searchParams.set('include_reply_count', '1');
    url.searchParams.set('tweet_mode', 'extended');
    url.searchParams.set('include_ext_views', 'true');
    url.searchParams.set('include_ext_media_color', 'true');
    url.searchParams.set('supports_reactions', 'true');
    url.searchParams.set('include_ext_edit_control', 'true');
    url.searchParams.set('ext', 'mediaColor,altText,mediaStats,highlightedLabel,voiceInfo,birdwatchPivot,superFollowMetadata,unmentionInfo,editControl');
    
    if (cursor) {
      url.searchParams.set('max_id', cursor);
    }

    const data = await this.dmRequest<RawDMConversationResponse>(url.toString());
    return this.parseDMConversation(data, conversationId);
  }

  /**
   * Make a request to the DM REST API
   */
  private async dmRequest<T>(url: string): Promise<T> {
    // Add jitter to avoid detection
    if (this.options.jitterMs) {
      await this.sleep(Math.random() * this.options.jitterMs);
    }

    // Check rate limits
    await this.rateLimiter.waitIfNeeded('dm');

    const headers = this.getHeaders();
    headers['x-client-transaction-id'] = generateTransactionId();

    // Get proxy dispatcher if configured
    const dispatcher = this.getDispatcher();
    const currentProxy = this.proxyManager?.getCurrent();

    try {
      const response = await request(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.options.timeoutMs!),
        dispatcher,
      });

      // Mark proxy success
      if (currentProxy) {
        this.proxyManager?.markSuccess(currentProxy.url);
      }

      // Update rate limit tracking
      this.rateLimiter.update('dm', {
        limit: parseInt(response.headers['x-rate-limit-limit'] as string) || 0,
        remaining: parseInt(response.headers['x-rate-limit-remaining'] as string) || 0,
        reset: parseInt(response.headers['x-rate-limit-reset'] as string) || 0,
      });

      if (response.statusCode !== 200) {
        const body = await response.body.text();
        throw new Error(`DM API error (${response.statusCode}): ${body}`);
      }

      return await response.body.json() as T;
    } catch (error) {
      // Mark proxy failure and rotate
      if (currentProxy) {
        this.proxyManager?.markFailed(currentProxy.url);
        // Rotate to next proxy
        this.proxyManager?.getNext();
      }
      throw error;
    }
  }

  /**
   * Parse raw DM inbox response
   */
  private parseDMInbox(data: RawDMInboxResponse): DMInboxResponse {
    const inbox = data.inbox_initial_state || data.user_events;
    
    if (!inbox) {
      return {
        conversations: [],
        hasMore: false,
      };
    }

    const users = inbox.users || {};
    const rawConversations = inbox.conversations || {};
    const entries = inbox.entries || [];

    // Build a map of user IDs to user info
    const userMap = new Map<string, RawDMUser>();
    for (const [id, user] of Object.entries(users)) {
      userMap.set(id, user);
    }

    // Get last message per conversation
    const lastMessages = new Map<string, DMMessage>();
    for (const entry of entries) {
      if (entry.message) {
        const msg = this.parseMessage(entry);
        if (msg) {
          const existing = lastMessages.get(msg.conversationId);
          if (!existing || msg.time > existing.time) {
            lastMessages.set(msg.conversationId, msg);
          }
        }
      }
    }

    // Build conversation list
    const conversations: DMConversation[] = [];
    
    for (const [convId, rawConv] of Object.entries(rawConversations)) {
      const participants: DMParticipant[] = [];
      
      for (const p of rawConv.participants || []) {
        const user = userMap.get(p.user_id);
        if (user) {
          participants.push({
            userId: user.id_str,
            screenName: user.screen_name,
            name: user.name,
            profileImageUrl: user.profile_image_url_https,
          });
        }
      }

      conversations.push({
        conversationId: rawConv.conversation_id,
        type: rawConv.type,
        sortTimestamp: rawConv.sort_timestamp,
        participants,
        lastMessage: lastMessages.get(convId),
        unreadCount: 0, // API doesn't expose this directly
        trusted: rawConv.trusted,
        muted: rawConv.muted,
        name: rawConv.name,
      });
    }

    // Sort by timestamp (most recent first)
    conversations.sort((a, b) => {
      return b.sortTimestamp.localeCompare(a.sortTimestamp);
    });

    // Determine cursor for pagination
    let cursor: string | undefined;
    // inbox_timelines only exists on inbox_initial_state, not on user_events
    const inboxTimelines = (inbox as typeof data.inbox_initial_state)?.inbox_timelines;
    if (inboxTimelines?.trusted?.min_entry_id) {
      cursor = inboxTimelines.trusted.min_entry_id;
    }

    return {
      conversations,
      cursor,
      hasMore: !!cursor,
    };
  }

  /**
   * Parse raw DM conversation response
   */
  private parseDMConversation(
    data: RawDMConversationResponse,
    conversationId: string
  ): DMConversationResponse {
    const timeline = data.conversation_timeline;
    
    if (!timeline || timeline.status !== 'HAS_MORE') {
      // If status is AT_END, there's no more history
      const entries = timeline?.entries || [];
      const messages = entries
        .map(e => this.parseMessage(e))
        .filter((m): m is DMMessage => m !== null)
        .sort((a, b) => a.time.localeCompare(b.time)); // chronological

      return {
        messages,
        conversationId,
        hasMore: timeline?.status === 'HAS_MORE',
      };
    }

    const entries = timeline.entries || [];
    const messages = entries
      .map(e => this.parseMessage(e))
      .filter((m): m is DMMessage => m !== null)
      .sort((a, b) => a.time.localeCompare(b.time)); // chronological

    return {
      messages,
      cursor: timeline.min_entry_id,
      conversationId,
      hasMore: true,
    };
  }

  /**
   * Parse a single message entry
   */
  private parseMessage(entry: RawDMEntry): DMMessage | null {
    if (!entry.message) return null;
    
    const msg = entry.message;
    const data = msg.message_data;
    
    // Extract media URLs
    const mediaUrls: string[] = [];
    if (data.attachment?.photo) {
      mediaUrls.push(data.attachment.photo.media_url_https);
    }
    if (data.attachment?.video?.variants) {
      // Get highest quality video
      const sorted = [...data.attachment.video.variants]
        .filter(v => v.bitrate !== undefined)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      if (sorted.length > 0) {
        mediaUrls.push(sorted[0].url);
      }
    }

    return {
      id: data.id,
      time: data.time,
      senderId: data.sender_id,
      text: data.text,
      conversationId: msg.conversation_id,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      entities: data.entities ? {
        urls: data.entities.urls?.map(u => ({
          url: u.url,
          expandedUrl: u.expanded_url,
          displayUrl: u.display_url,
        })),
      } : undefined,
    };
  }
}

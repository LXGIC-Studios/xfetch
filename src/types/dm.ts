// DM types

export interface DMConversation {
  conversationId: string;
  type: 'ONE_TO_ONE' | 'GROUP_DM';
  sortTimestamp: string;
  participants: DMParticipant[];
  lastMessage?: DMMessage;
  unreadCount: number;
  trusted: boolean;
  muted: boolean;
  name?: string; // for group DMs
}

export interface DMParticipant {
  userId: string;
  screenName: string;
  name: string;
  profileImageUrl: string;
}

export interface DMMessage {
  id: string;
  time: string;
  senderId: string;
  text: string;
  conversationId: string;
  mediaUrls?: string[];
  entities?: {
    urls?: Array<{
      url: string;
      expandedUrl: string;
      displayUrl: string;
    }>;
  };
}

export interface DMInboxResponse {
  conversations: DMConversation[];
  cursor?: string;
  hasMore: boolean;
}

export interface DMConversationResponse {
  messages: DMMessage[];
  cursor?: string;
  hasMore: boolean;
  conversationId: string;
}

// Raw API response types

export interface RawDMInboxResponse {
  inbox_initial_state?: {
    cursor?: string;
    inbox_timelines?: {
      trusted?: {
        status: string;
        min_entry_id?: string;
      };
      untrusted?: {
        status: string;
        min_entry_id?: string;
      };
    };
    entries?: RawDMEntry[];
    users?: Record<string, RawDMUser>;
    conversations?: Record<string, RawDMConversation>;
  };
  // Alternative response structure for pagination
  user_events?: {
    cursor?: string;
    entries?: RawDMEntry[];
    users?: Record<string, RawDMUser>;
    conversations?: Record<string, RawDMConversation>;
  };
}

export interface RawDMConversationResponse {
  conversation_timeline?: {
    status: string;
    min_entry_id?: string;
    max_entry_id?: string;
    entries?: RawDMEntry[];
    users?: Record<string, RawDMUser>;
    conversations?: Record<string, RawDMConversation>;
  };
}

export interface RawDMEntry {
  message?: {
    id: string;
    time: string;
    conversation_id: string;
    message_data: {
      id: string;
      time: string;
      sender_id: string;
      text: string;
      entities?: {
        urls?: Array<{
          url: string;
          expanded_url: string;
          display_url: string;
        }>;
      };
      attachment?: {
        photo?: {
          url: string;
          media_url_https: string;
        };
        video?: {
          variants: Array<{
            url: string;
            bitrate?: number;
          }>;
        };
      };
    };
  };
}

export interface RawDMUser {
  id_str: string;
  screen_name: string;
  name: string;
  profile_image_url_https: string;
}

export interface RawDMConversation {
  conversation_id: string;
  type: 'ONE_TO_ONE' | 'GROUP_DM';
  sort_timestamp: string;
  participants: Array<{
    user_id: string;
  }>;
  read_only: boolean;
  notifications_disabled: boolean;
  trusted: boolean;
  muted: boolean;
  name?: string;
  last_read_event_id?: string;
  status: string;
}

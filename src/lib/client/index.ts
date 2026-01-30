import { BaseClient } from './base.js';
import { UserMixin } from './users.js';
import { TweetMixin } from './tweets.js';
import { SearchMixin } from './search.js';
import { TimelineMixin } from './timelines.js';
import { ListMixin } from './lists.js';
import { DMMixin } from './dms.js';
import { NotificationsMixin } from './notifications.js';
import type { Session, ClientOptions } from '../../types/twitter.js';

// Mixin helper
function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      if (name !== 'constructor') {
        Object.defineProperty(
          derivedCtor.prototype,
          name,
          Object.getOwnPropertyDescriptor(baseCtor.prototype, name) || Object.create(null)
        );
      }
    });
  });
}

// Combined client with all mixins
export class XClient extends BaseClient {
  constructor(session: Session, options?: ClientOptions) {
    super(session, options);
  }
}

// Apply mixins
export interface XClient extends UserMixin, TweetMixin, SearchMixin, TimelineMixin, ListMixin, DMMixin, NotificationsMixin {}
applyMixins(XClient, [UserMixin, TweetMixin, SearchMixin, TimelineMixin, ListMixin, DMMixin, NotificationsMixin]);

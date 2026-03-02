// background/discord-api.js
// Discord REST API client that uses the rate limiter to stay within limits.
// Provides methods for guilds, channels, threads, and paginated message fetching.

import { RateLimiter } from './rate-limiter.js';

const BASE_URL = 'https://discord.com/api/v10';

export class DiscordAPI {
  constructor(rateLimiter) {
    this.rateLimiter = rateLimiter;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  _headers() {
    return {
      'Authorization': this.token,
      'Content-Type': 'application/json',
    };
  }

  async getGuilds() {
    const resp = await this.rateLimiter.request(
      `${BASE_URL}/users/@me/guilds?with_counts=true`,
      { headers: this._headers() }
    );
    if (!resp.ok) throw new Error(`Failed to fetch guilds: ${resp.status}`);
    return resp.json();
  }

  async getGuildChannels(guildId) {
    const resp = await this.rateLimiter.request(
      `${BASE_URL}/guilds/${guildId}/channels`,
      { headers: this._headers() }
    );
    if (!resp.ok) throw new Error(`Failed to fetch channels: ${resp.status}`);
    return resp.json();
  }

  async getActiveThreads(guildId) {
    const resp = await this.rateLimiter.request(
      `${BASE_URL}/guilds/${guildId}/threads/active`,
      { headers: this._headers() }
    );
    if (!resp.ok) throw new Error(`Failed to fetch active threads: ${resp.status}`);
    const data = await resp.json();
    return data.threads || [];
  }

  async getArchivedPublicThreads(channelId, before = null) {
    let url = `${BASE_URL}/channels/${channelId}/threads/archived/public?limit=100`;
    if (before) url += `&before=${before}`;
    const resp = await this.rateLimiter.request(url, { headers: this._headers() });
    if (!resp.ok) throw new Error(`Failed to fetch archived threads: ${resp.status}`);
    return resp.json(); // { threads: [], has_more: bool }
  }

  // Core pagination: async generator yielding batches of 100 messages
  async *getMessagesIterator(channelId, onProgress) {
    let beforeId = null;
    let totalFetched = 0;

    while (true) {
      let url = `${BASE_URL}/channels/${channelId}/messages?limit=100`;
      if (beforeId) url += `&before=${beforeId}`;

      const resp = await this.rateLimiter.request(url, { headers: this._headers() });

      if (!resp.ok) {
        if (resp.status === 403) {
          // No permission — skip this channel
          console.warn(`[DiscordAPI] No access to channel ${channelId} (403)`);
          return;
        }
        throw new Error(`Failed to fetch messages: ${resp.status}`);
      }

      const messages = await resp.json();

      if (!Array.isArray(messages) || messages.length === 0) break;

      yield messages;

      totalFetched += messages.length;
      if (onProgress) onProgress(totalFetched);

      // Set cursor to oldest message in batch
      beforeId = messages[messages.length - 1].id;

      // Less than 100 means we've reached the beginning
      if (messages.length < 100) break;
    }
  }

  // Get all threads for a channel (active + archived)
  async getAllThreads(channelId, guildId) {
    const threads = [];

    // Active threads (guild-wide, filter by parent)
    try {
      const active = await this.getActiveThreads(guildId);
      threads.push(...active.filter(t => t.parent_id === channelId));
    } catch (e) {
      console.warn(`[DiscordAPI] Failed to fetch active threads: ${e.message}`);
    }

    // Archived public threads (paginated)
    let hasMore = true;
    let before = null;
    while (hasMore) {
      try {
        const result = await this.getArchivedPublicThreads(channelId, before);
        if (result.threads?.length > 0) {
          threads.push(...result.threads);
          before = result.threads[result.threads.length - 1].thread_metadata?.archive_timestamp;
        }
        hasMore = result.has_more === true;
        if (!result.threads?.length) hasMore = false;
      } catch (e) {
        console.warn(`[DiscordAPI] Failed to fetch archived threads: ${e.message}`);
        hasMore = false;
      }
    }

    return threads;
  }
}

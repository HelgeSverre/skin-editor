// background/rate-limiter.js
// Request queue that respects Discord API rate limits.
// Processes requests sequentially with a minimum 25ms gap (~40 req/s,
// safely under Discord's 50/s global limit).

export class RateLimiter {
  constructor() {
    this.buckets = new Map(); // bucketId -> { remaining, resetAt }
    this.queue = [];
    this.processing = false;
  }

  /**
   * Enqueue a fetch request. Returns the Response once the request
   * has been executed (respecting rate limits and retries).
   */
  async request(url, options = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({ url, options, resolve, reject, retries: 0 });
      this._processQueue();
    });
  }

  async _processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();

      try {
        const response = await this._executeWithRetry(item);
        item.resolve(response);
      } catch (err) {
        item.reject(err);
      }

      // Minimum delay between requests
      await this._sleep(25);
    }

    this.processing = false;
  }

  async _executeWithRetry(item) {
    const maxRetries = 3;

    while (true) {
      try {
        const response = await fetch(item.url, item.options);

        // Parse rate limit headers
        this._updateBucket(response.headers);

        // Handle 429 Too Many Requests
        if (response.status === 429) {
          const body = await response.json();
          const retryAfter = (body.retry_after || 1) * 1000;
          console.log(`[RateLimiter] 429 hit, waiting ${retryAfter}ms`);
          await this._sleep(retryAfter);
          continue; // Retry same request
        }

        // Check if we need to preemptively slow down
        const bucket = response.headers.get('X-RateLimit-Bucket');
        if (bucket) {
          const info = this.buckets.get(bucket);
          if (info && info.remaining < 3) {
            const waitMs = Math.max(0, info.resetAt - Date.now()) + 50;
            if (waitMs > 0) {
              console.log(
                `[RateLimiter] Preemptive wait ${waitMs}ms (remaining: ${info.remaining})`
              );
              await this._sleep(waitMs);
            }
          }
        }

        return response;
      } catch (err) {
        item.retries++;
        if (item.retries >= maxRetries) {
          throw err;
        }
        const backoff = Math.pow(2, item.retries - 1) * 1000; // 1s, 2s, 4s
        console.log(
          `[RateLimiter] Network error, retry ${item.retries}/${maxRetries} in ${backoff}ms`
        );
        await this._sleep(backoff);
      }
    }
  }

  _updateBucket(headers) {
    const bucket = headers.get('X-RateLimit-Bucket');
    const remaining = parseInt(headers.get('X-RateLimit-Remaining'));
    const resetAfter = parseFloat(headers.get('X-RateLimit-Reset-After'));

    if (bucket && !isNaN(remaining)) {
      this.buckets.set(bucket, {
        remaining,
        resetAt: Date.now() + (isNaN(resetAfter) ? 1000 : resetAfter * 1000),
      });
    }
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

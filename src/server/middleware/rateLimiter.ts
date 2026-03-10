// Token Bucket Rate Limiter
// Imagine a bucket that holds tokens. Tokens are added at a constant rate (refillRate per second).
// The bucket can hold at most `capacity` tokens — extras are discarded (bucket is full).
// Every request costs 1 token. If there's a token available, the request goes through.
// If the bucket is empty (0 tokens), the request is rejected with 429.

// Unlike leaky bucket which smooths traffic, token bucket ALLOWS bursts.
// If a client was idle and tokens accumulated to capacity, they can
// fire `capacity` requests all at once (using all saved tokens).
// After that, they're limited to `refillRate` requests/second -> like leaky bucket.

import type { Request, Response, NextFunction } from 'express';

interface TokenBucket {
    tokens: number;       // current number of tokens in the bucket
    lastRefill: number;   // timestamp when we last calculated the refill
}

export class TokenBucketRateLimiter {
    private buckets = new Map<string, TokenBucket>(); // one bucket per client IP
    private capacity: number;      // max tokens the bucket can hold
    private refillRate: number;    // tokens added per second

    constructor(capacity: number, refillRate: number) {
        this.capacity = capacity;
        this.refillRate = refillRate;
    }

    /**
     * Refill tokens based on elapsed time since last check.
     * We don't use a timer — we calculate how many tokens would have been
     * added since the last request from this IP.
     *
     * e.g. lastRefill was 3 seconds ago, refillRate = 2/sec
     *      → 3 × 2 = 6 tokens added (capped at capacity)
     */
    private refill(bucket: TokenBucket): void {
        const now = Date.now();
        const elapsedSeconds = (now - bucket.lastRefill) / 1000;

        // Add tokens proportional to elapsed time
        const tokensToAdd = elapsedSeconds * this.refillRate;
        bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
    }

    /**
     * Express middleware.
     *
     * Flow per request:
     * 1. Get (or create) the bucket for this client IP
     * 2. Refill tokens based on elapsed time
     * 3. If tokens >= 1 → consume 1 token, allow request through
     * 4. If tokens < 1  → reject with 429 Too Many Requests
     */
    middleware() {
        return (req: Request, res: Response, next: NextFunction): void => {
            const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

            // Get or create this IP's bucket (new buckets start full — client gets a full burst)
            let bucket = this.buckets.get(clientIp);
            if (!bucket) {
                bucket = { tokens: this.capacity, lastRefill: Date.now() };
                this.buckets.set(clientIp, bucket);
            }

            // Step 1: Refill tokens based on elapsed time
            this.refill(bucket);

            // Set rate limit headers on every response so the client knows their status
            res.set('X-RateLimit-Limit', String(this.capacity));
            res.set('X-RateLimit-Remaining', String(Math.floor(bucket.tokens)));

            // Try to consume a token
            if (bucket.tokens >= 1) {
                bucket.tokens -= 1;
                next(); // allow — request proceeds to route handler → proxy → upstream
            } else {
                // No tokens left — bucket is empty
                const retryAfter = Math.ceil(1 / this.refillRate); // seconds until 1 token is available
                res.set('Retry-After', String(retryAfter));

                res.status(429).json({
                    error: 'Too Many Requests',
                    message: `Rate limit exceeded. No tokens left (capacity: ${this.capacity}, refill: ${this.refillRate}/sec). Retry in ${retryAfter}s.`,
                });
            }
        };
    }
}

import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const options = {
  maxRetriesPerRequest: 3,
  // Keep reconnecting with backoff instead of throwing on boot.
  retryStrategy: (times: number) => Math.min(times * 200, 2000),
};

export const redis = new IORedis.default(REDIS_URL, options);
export const redisSub = new IORedis.default(REDIS_URL, options);

// Never let a Redis connection error crash the process (unhandled 'error'
// events on an EventEmitter are thrown). Log and let retryStrategy recover.
redis.on('error', (err) => console.error('[redis] connection error:', err.message));
redisSub.on('error', (err) => console.error('[redisSub] connection error:', err.message));

import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new IORedis.default(REDIS_URL, { maxRetriesPerRequest: 3 });
export const redisSub = new IORedis.default(REDIS_URL, { maxRetriesPerRequest: 3 });

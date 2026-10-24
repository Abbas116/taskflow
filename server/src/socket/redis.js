import { createClient } from 'redis';

// Redis is OPTIONAL. Without REDIS_URL everything runs in a single process (local dev, Render, etc.).
// With REDIS_URL, several server instances (Vercel functions) share rooms and events through Redis.
let client = null;
let connecting = null;

export function redisClient() {
  if (!process.env.REDIS_URL) return null;
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Redis error:', err.message));
    connecting = client.connect();
    connecting.catch(() => {});
  }
  return client;
}

export async function redisPair() {
  const pub = redisClient();
  if (!pub) return null;
  await connecting;
  const sub = pub.duplicate();
  await sub.connect();
  return { pub, sub };
}

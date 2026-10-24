import 'dotenv/config';
import http from 'http';
import connectDB from './config/db.js';
import { createApp, allowedOrigins } from './app.js';
import { initSocket, attachRedisAdapter } from './socket/index.js';
import { startDueSoonJob } from './jobs/dueSoon.js';

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in .env');
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  const server = http.createServer(createApp());
  const io = initSocket(server, allowedOrigins);
  if (await attachRedisAdapter(io)) console.log('Socket.io: Redis adapter enabled');
  startDueSoonJob();
  server.listen(PORT, () => console.log(`TaskFlow API + Socket.io listening on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

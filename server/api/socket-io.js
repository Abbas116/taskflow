// Vercel Function: Socket.IO server (WebSocket connections).
// Browsers connect with path "/api/socket-io/socket.io" and transport "websocket".
import http from 'http';
import { allowedOrigins } from '../src/app.js';
import { initSocket, attachRedisAdapter, stripVercelPrefix } from '../src/socket/index.js';

const server = http.createServer();
stripVercelPrefix(server);
const io = initSocket(server, allowedOrigins);
await attachRedisAdapter(io); // requires REDIS_URL so rooms/events work across function instances

export default server;

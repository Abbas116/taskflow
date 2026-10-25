import http from 'http';
import { allowedOrigins } from '../../src/app.js';
import { initSocket, attachRedisAdapter, stripVercelPrefix } from '../../src/socket/index.js';

const server = http.createServer();
stripVercelPrefix(server);
const io = initSocket(server, allowedOrigins);
await attachRedisAdapter(io);

export default server;

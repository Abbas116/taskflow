import http from 'http';
import { createApp, allowedOrigins } from '../src/app.js';
import { initSocket, attachRedisAdapter } from '../src/socket/index.js';

const server = http.createServer(createApp());
const io = initSocket(server, allowedOrigins, '/api/socket.io');
await attachRedisAdapter(io);

export default server;

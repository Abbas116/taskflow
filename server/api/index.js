// Vercel Function: the whole REST API (Express). Real-time events are published to Redis,
// and the socket function (api/socket-io.js) delivers them to connected browsers.
import { createApp } from '../src/app.js';

export default createApp();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';

export const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim());

export function createApp() {
  const app = express();
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' })); // avatars are sent as small data URLs
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

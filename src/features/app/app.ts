import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { ZodError } from 'zod';
import { authRouter } from '../../api/auth/auth.routes';
import { eventsRouter } from '../../api/events/events.routes';
import { healthRouter } from '../../api/health/health.routes';
import { positionsRouter } from '../../api/positions/positions.routes';
import { sorobanRouter } from '../../api/soroban/soroban.routes';
import { env } from '../config/env';
import { logger } from '../config/logger';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', env.isProduction);
  app.disable('x-powered-by');

  const allowedOrigins = env.corsOrigin
    ? env.corsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    : undefined;

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins ?? true,
      credentials: true,
    })
  );

  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );

  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/positions', positionsRouter);
  app.use('/events', eventsRouter);
  app.use('/soroban', sorobanRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: err.issues });
      }

      logger.error({ err }, 'Unhandled error');
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  );

  return app;
};

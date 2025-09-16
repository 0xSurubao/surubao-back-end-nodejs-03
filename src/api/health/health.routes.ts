import { Router } from 'express';
import { env } from '../../features/config/env';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', commit: env.commitSha ?? 'unknown', time: new Date().toISOString() });
});

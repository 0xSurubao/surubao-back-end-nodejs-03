import { Router } from 'express';
import { z } from 'zod';
import { issueAccessToken } from '../../features/auth/jwt';
import { Sep10Error, buildSep10Challenge, verifySep10Challenge } from '../../features/stellar/sep10';
import { authenticateJwt, optionalJwt } from '../../features/auth/auth-middleware';
import { authRateLimiter } from '../../features/rate-limit/rate-limit';

const sep10QuerySchema = z.object({
  account: z.string().min(1, 'account is required'),
});

const verifyBodySchema = z.object({
  signedXDR: z.string().min(1, 'signedXDR is required'),
  clientPublicKey: z.string().min(1, 'clientPublicKey is required'),
});

export const authRouter = Router();

authRouter.use(optionalJwt);
authRouter.use(authRateLimiter);

authRouter.get('/sep10', (req, res) => {
  const parsed = sep10QuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
  }

  try {
    const { challengeXDR, expiresAt, networkPassphrase } = buildSep10Challenge(parsed.data.account);
    return res.json({
      challengeXDR,
      networkPassphrase,
      expiresAt,
    });
  } catch (err) {
    if (err instanceof Sep10Error) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: 'Failed to generate SEP-10 challenge' });
  }
});

authRouter.post('/sep10/verify', async (req, res) => {
  const parsed = verifyBodySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
  }

  try {
    verifySep10Challenge(parsed.data.signedXDR, parsed.data.clientPublicKey);

    const { token, expiresAt } = issueAccessToken(parsed.data.clientPublicKey, []);
    return res.json({ accessToken: token, expiresAt });
  } catch (err) {
    if (err instanceof Sep10Error) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(400).json({ error: 'SEP-10 verification failed' });
  }
});

authRouter.get('/me', authenticateJwt, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.json({
    sub: req.user.sub,
    scopes: req.user.scopes,
    tokenExp: req.user.tokenExp,
  });
});

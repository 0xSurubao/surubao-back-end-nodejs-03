import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from './jwt';

const parseAuthHeader = (header?: string | null) => {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) {
    return null;
  }
  return value.trim();
};

export const authenticateJwt = (req: Request, res: Response, next: NextFunction) => {
  const token = parseAuthHeader(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      token,
      sub: payload.sub,
      scopes: payload.scopes,
      tokenExp: payload.exp,
    };
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

export const optionalJwt = (req: Request, _res: Response, next: NextFunction) => {
  const token = parseAuthHeader(req.headers.authorization);
  if (!token) {
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      token,
      sub: payload.sub,
      scopes: payload.scopes,
      tokenExp: payload.exp,
    };
  } catch (_err) {
    // ignore invalid tokens for optional auth
  }

  next();
};

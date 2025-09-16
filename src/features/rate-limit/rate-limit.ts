import { NextFunction, Request, Response } from "express";

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 30;

type RateLimiterOptions = {
  windowMs?: number;
  max?: number;
  name?: string;
};

type Entry = {
  count: number;
  expiresAt: number;
};

const createKey = (req: Request) => req.user?.sub ?? req.ip ?? "anonymous";

export const createRateLimiter = ({
  windowMs = DEFAULT_WINDOW_MS,
  max = DEFAULT_MAX,
  name = "rate-limit",
}: RateLimiterOptions = {}) => {
  const store = new Map<string, Entry>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = name + ":" + createKey(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.expiresAt <= now) {
      store.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.expiresAt - now) / 1000);
      res.setHeader("Retry-After", retryAfter.toString());
      return res.status(429).json({ error: "Too Many Requests", retryAfter });
    }

    entry.count += 1;
    return next();
  };
};

export const authRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 15,
  name: "auth",
});

export const sorobanRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
  name: "soroban",
});
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { ZodError } from "zod";
import { registerAuthRoutes } from "../../api/auth/auth-route";
import { registerEventsRoutes } from "../../api/events/events-route";
import { registerHealthRoutes } from "../../api/health/health-route";
import { registerPositionsRoutes } from "../../api/positions/positions-route";
import { registerSorobanRoutes } from "../../api/soroban/soroban-route";
import { env } from "../config/env";
import { logger } from "../config/logger";

export const createApp = () => {
  const app = express();

  app.set("trust proxy", env.isProduction);
  app.disable("x-powered-by");

  const allowedOrigins = env.corsOrigin
    ? env.corsOrigin
        .split(",")
        .map((origin: string) => origin.trim())
        .filter((origin: string) => origin.length > 0)
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
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    })
  );

  app.use(express.json({ limit: "1mb" }));

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerPositionsRoutes(app);
  registerEventsRoutes(app);
  registerSorobanRoutes(app);

  app.use((_req: express.Request, res: express.Response) => {
    res.status(404).json({ error: "Not Found" });
  });

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: "Invalid request", details: err.issues });
      }

      const error = err instanceof Error ? err : new Error(String(err));
      logger.error({ err: error }, "Unhandled error");
      return res.status(500).json({ error: "Internal Server Error" });
    }
  );

  return app;
};
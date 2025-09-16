import { Express, Router } from "express";
import { env } from "../../features/config/env";

const createHealthRouter = () => {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ status: "ok", commit: env.commitSha ?? "unknown", time: new Date().toISOString() });
  });

  return router;
};

export const registerHealthRoutes = (app: Express) => {
  app.use("/health", createHealthRouter());
};
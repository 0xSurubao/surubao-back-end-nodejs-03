import { createServer } from "http";
import { createApp } from "./features/app/create-app";
import { env } from "./features/config/env";
import { logger } from "./features/config/logger";
import { startSorobanIndexer } from "./features/indexer/soroban-indexer";

const bootstrap = async () => {
  const app = createApp();
  const server = createServer(app);
  const indexer = startSorobanIndexer();

  server.listen(env.port, () => {
    logger.info({ port: env.port, nodeEnv: env.nodeEnv }, "Surubao backend listening");
  });

  const stop = () => {
    logger.info("Shutting down HTTP server");
    indexer.stop();
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
};

bootstrap().catch((err) => {
  logger.error({ err }, "Fatal error during bootstrap");
  process.exit(1);
});
import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './shared/logger';
import { prisma } from './shared/database/prisma';
import { closeRealtime, initRealtime } from './shared/realtime/socket';
import { modules } from './modules';

async function bootstrap() {
  await prisma.$connect();

  const app = createApp();
  const server = http.createServer(app);
  initRealtime(server);

  await new Promise<void>((resolve) => server.listen(env.PORT, resolve));
  logger.info(`TWCS API listening on http://localhost:${env.PORT}/api/v1`);

  for (const mod of modules) {
    await mod.onInit?.();
    logger.info(`Module ready: ${mod.name}`);
  }

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    for (const mod of [...modules].reverse()) await mod.onShutdown?.();
    await closeRealtime();
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});

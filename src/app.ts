import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './shared/logger';
import { errorHandler, notFoundHandler } from './shared/http/middleware/error-handler';
import { modules } from './modules';

// Reading ids are BigInt; make them JSON-serialisable.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  for (const mod of modules) {
    if (mod.router && mod.basePath) {
      app.use(`/api/v1/${mod.basePath}`, mod.router);
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

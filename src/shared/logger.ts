import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.isDev ? 'debug' : 'info',
  transport: env.isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
});

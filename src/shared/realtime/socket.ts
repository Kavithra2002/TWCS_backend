import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../../config/env';
import { eventBus } from '../events/event-bus';
import { verifyToken } from '../http/middleware/auth';
import { logger } from '../logger';

let io: Server | null = null;

/**
 * Realtime gateway: forwards domain events to connected browsers.
 * Every client receives the overview streams; clients can also join
 * "trough:<id>" rooms for trough-scoped events.
 */
export function initRealtime(server: HttpServer): Server {
  io = new Server(server, { cors: { origin: env.corsOrigins, credentials: true } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Unauthorized'));
    try {
      verifyToken(token);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    logger.debug({ id: socket.id }, 'Socket connected');
    socket.on('trough:subscribe', (troughId: string) => socket.join(`trough:${troughId}`));
    socket.on('trough:unsubscribe', (troughId: string) => socket.leave(`trough:${troughId}`));
  });

  eventBus.on('telemetry.reading.recorded', (reading) => {
    io?.emit('reading', reading);
  });
  eventBus.on('alert.raised', (alert) => {
    io?.emit('alert', alert);
  });
  eventBus.on('alert.acknowledged', (payload) => {
    io?.emit('alert:acknowledged', payload);
  });
  eventBus.on('trough.status.changed', (payload) => {
    io?.emit('trough:status', payload);
  });
  eventBus.on('batch.changed', (payload) => {
    io?.emit('batch:changed', payload);
  });
  eventBus.on('schedule.triggered', (payload) => {
    io?.emit('schedule:triggered', payload);
  });

  return io;
}

export function closeRealtime(): Promise<void> {
  return new Promise((resolve) => (io ? io.close(() => resolve()) : resolve()));
}

import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors';
import { logger } from '../../logger';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { message: `Route ${req.method} ${req.originalUrl} not found` } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { message: 'Validation failed', details: err.flatten() } });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { message: 'Resource already exists' } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { message: 'Resource not found' } });
      return;
    }
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { message: 'Internal server error' } });
};

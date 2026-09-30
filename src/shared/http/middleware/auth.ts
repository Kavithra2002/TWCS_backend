import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../../../config/env';
import { forbidden, unauthorized } from '../errors';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthUser {
  const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser & jwt.JwtPayload;
  return { id: payload.id, email: payload.email, name: payload.name, role: payload.role };
}

/** Requires a valid Bearer token. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized());
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
};

/** Restricts a route to the given roles. Use after `authenticate`. */
export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };

/** Authenticates IoT gateways posting telemetry. */
export const authenticateDevice: RequestHandler = (req, _res, next) => {
  if (req.headers['x-device-key'] !== env.DEVICE_API_KEY) return next(unauthorized('Invalid device key'));
  next();
};

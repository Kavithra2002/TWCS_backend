import { Router } from 'express';
import { authenticate } from '../../shared/http/middleware/auth';
import { validate } from '../../shared/http/middleware/validate';
import { authController } from './auth.controller';
import { loginSchema } from './auth.schemas';

export const authRouter = Router();

authRouter.post('/login', validate({ body: loginSchema }), authController.login);
authRouter.get('/me', authenticate, authController.me);

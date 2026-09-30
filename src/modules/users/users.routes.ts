import { Router } from 'express';
import { authenticate, authorize } from '../../shared/http/middleware/auth';
import { validate } from '../../shared/http/middleware/validate';
import { idParamSchema } from '../../shared/http/schemas';
import { usersController } from './users.controller';
import { createUserSchema, updateUserSchema } from './users.schemas';

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.get('/', authorize('ADMIN', 'SUPERVISOR'), usersController.list);
usersRouter.post('/', authorize('ADMIN'), validate({ body: createUserSchema }), usersController.create);
usersRouter.patch(
  '/:id',
  authorize('ADMIN'),
  validate({ params: idParamSchema, body: updateUserSchema }),
  usersController.update,
);

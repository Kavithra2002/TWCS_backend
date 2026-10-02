import { Router } from 'express';
import { authenticate, authorize } from '../../shared/http/middleware/auth';
import { validate } from '../../shared/http/middleware/validate';
import { idParamSchema } from '../../shared/http/schemas';
import { usersController } from './users.controller';
import { createUserSchema, updateUserSchema } from './users.schemas';

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.get('/', authorize('super_admin'), usersController.list);
usersRouter.post('/', authorize('super_admin'), validate({ body: createUserSchema }), usersController.create);
usersRouter.patch(
  '/:id',
  authorize('super_admin'),
  validate({ params: idParamSchema, body: updateUserSchema }),
  usersController.update,
);

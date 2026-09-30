import { Router } from 'express';
import { authenticate, authorize } from '../../shared/http/middleware/auth';
import { validate } from '../../shared/http/middleware/validate';
import { idParamSchema } from '../../shared/http/schemas';
import { factoriesController } from './factories.controller';
import { createFactorySchema, updateFactorySchema } from './factories.schemas';

export const factoriesRouter = Router();

factoriesRouter.use(authenticate);
factoriesRouter.get('/', factoriesController.list);
factoriesRouter.get('/:id', validate({ params: idParamSchema }), factoriesController.get);
factoriesRouter.post('/', authorize('ADMIN'), validate({ body: createFactorySchema }), factoriesController.create);
factoriesRouter.patch(
  '/:id',
  authorize('ADMIN'),
  validate({ params: idParamSchema, body: updateFactorySchema }),
  factoriesController.update,
);

import { Router } from 'express';
import { authenticate, authorize } from '../../shared/http/middleware/auth';
import { validate } from '../../shared/http/middleware/validate';
import { idParamSchema } from '../../shared/http/schemas';
import { troughsController } from './troughs.controller';
import {
  createTroughSchema,
  listTroughsQuerySchema,
  updateTroughSchema,
  updateTroughStatusSchema,
} from './troughs.schemas';

export const troughsRouter = Router();

troughsRouter.use(authenticate);
troughsRouter.get('/', validate({ query: listTroughsQuerySchema }), troughsController.list);
troughsRouter.get('/:id', validate({ params: idParamSchema }), troughsController.get);
troughsRouter.post('/', authorize('ADMIN'), validate({ body: createTroughSchema }), troughsController.create);
troughsRouter.patch(
  '/:id',
  authorize('ADMIN', 'SUPERVISOR', 'executive', 'engineering'),
  validate({ params: idParamSchema, body: updateTroughSchema }),
  troughsController.update,
);
troughsRouter.patch(
  '/:id/status',
  authorize('ADMIN', 'SUPERVISOR', 'OPERATOR', 'executive', 'operation', 'engineering'),
  validate({ params: idParamSchema, body: updateTroughStatusSchema }),
  troughsController.setStatus,
);

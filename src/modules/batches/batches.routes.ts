import { Router } from 'express';
import { authenticate, authorize } from '../../shared/http/middleware/auth';
import { validate } from '../../shared/http/middleware/validate';
import { idParamSchema } from '../../shared/http/schemas';
import { batchesController } from './batches.controller';
import {
  abortBatchSchema,
  completeBatchSchema,
  createBatchSchema,
  listBatchesQuerySchema,
} from './batches.schemas';

export const batchesRouter = Router();
const operators = authorize('ADMIN', 'SUPERVISOR', 'OPERATOR');

batchesRouter.use(authenticate);
batchesRouter.get('/', validate({ query: listBatchesQuerySchema }), batchesController.list);
batchesRouter.get('/:id', validate({ params: idParamSchema }), batchesController.get);
batchesRouter.post('/', operators, validate({ body: createBatchSchema }), batchesController.create);
batchesRouter.post('/:id/start', operators, validate({ params: idParamSchema }), batchesController.start);
batchesRouter.post(
  '/:id/complete',
  operators,
  validate({ params: idParamSchema, body: completeBatchSchema }),
  batchesController.complete,
);
batchesRouter.post(
  '/:id/abort',
  operators,
  validate({ params: idParamSchema, body: abortBatchSchema }),
  batchesController.abort,
);

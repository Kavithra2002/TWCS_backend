import { Router } from 'express';
import { authenticate, authorize } from '../../shared/http/middleware/auth';
import { validate } from '../../shared/http/middleware/validate';
import { idParamSchema } from '../../shared/http/schemas';
import { schedulesController } from './schedules.controller';
import { createScheduleSchema, listSchedulesQuerySchema, updateScheduleSchema } from './schedules.schemas';

export const schedulesRouter = Router();
const planners = authorize('ADMIN', 'SUPERVISOR');

schedulesRouter.use(authenticate);
schedulesRouter.get('/', validate({ query: listSchedulesQuerySchema }), schedulesController.list);
schedulesRouter.get('/today', schedulesController.today);
schedulesRouter.get('/:id', validate({ params: idParamSchema }), schedulesController.get);
schedulesRouter.post('/', planners, validate({ body: createScheduleSchema }), schedulesController.create);
schedulesRouter.patch(
  '/:id',
  planners,
  validate({ params: idParamSchema, body: updateScheduleSchema }),
  schedulesController.update,
);
schedulesRouter.delete('/:id', planners, validate({ params: idParamSchema }), schedulesController.remove);

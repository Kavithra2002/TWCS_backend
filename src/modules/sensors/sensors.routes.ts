import { Router } from 'express';
import { authenticate, authorize } from '../../shared/http/middleware/auth';
import { validate } from '../../shared/http/middleware/validate';
import { idParamSchema } from '../../shared/http/schemas';
import { sensorsController } from './sensors.controller';
import { listSensorsQuerySchema, updateSensorSchema } from './sensors.schemas';

export const sensorsRouter = Router();

sensorsRouter.use(authenticate);
sensorsRouter.get('/', validate({ query: listSensorsQuerySchema }), sensorsController.list);
sensorsRouter.get('/:id', validate({ params: idParamSchema }), sensorsController.get);
sensorsRouter.patch(
  '/:id',
  authorize('ADMIN', 'SUPERVISOR'),
  validate({ params: idParamSchema, body: updateSensorSchema }),
  sensorsController.update,
);

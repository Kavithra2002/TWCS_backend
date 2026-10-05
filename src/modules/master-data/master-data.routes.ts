import { Router } from 'express';
import { authenticate, authorize } from '../../shared/http/middleware/auth';
import { validate } from '../../shared/http/middleware/validate';
import { idParamSchema } from '../../shared/http/schemas';
import { masterDataController } from './master-data.controller';
import { assignScreensSchema, createScreenSchema, createViewSchema, userParamSchema, viewParamsSchema } from './master-data.schemas';

export const masterDataRouter = Router();

masterDataRouter.use(authenticate, authorize('super_admin'));

masterDataRouter.get('/screens', masterDataController.list);
masterDataRouter.post('/screens', validate({ body: createScreenSchema }), masterDataController.createScreen);
masterDataRouter.delete('/screens/:id', validate({ params: idParamSchema }), masterDataController.deleteScreen);

masterDataRouter.post(
  '/screens/:id/views',
  validate({ params: idParamSchema, body: createViewSchema }),
  masterDataController.createView,
);
masterDataRouter.delete(
  '/screens/:id/views/:viewId',
  validate({ params: viewParamsSchema }),
  masterDataController.deleteView,
);

masterDataRouter.put(
  '/users/:userId/screens',
  validate({ params: userParamSchema, body: assignScreensSchema }),
  masterDataController.assignScreens,
);

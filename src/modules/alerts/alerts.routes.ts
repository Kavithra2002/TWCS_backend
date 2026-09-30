import { Router } from 'express';
import { authenticate, authorize } from '../../shared/http/middleware/auth';
import { validate } from '../../shared/http/middleware/validate';
import { idParamSchema } from '../../shared/http/schemas';
import { alertsController } from './alerts.controller';
import { listAlertsQuerySchema } from './alerts.schemas';

export const alertsRouter = Router();

alertsRouter.use(authenticate);
alertsRouter.get('/', validate({ query: listAlertsQuerySchema }), alertsController.list);
alertsRouter.post(
  '/:id/acknowledge',
  authorize('ADMIN', 'SUPERVISOR', 'OPERATOR'),
  validate({ params: idParamSchema }),
  alertsController.acknowledge,
);

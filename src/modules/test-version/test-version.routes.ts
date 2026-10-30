import { Router } from 'express';
import { authenticate, authorize } from '../../shared/http/middleware/auth';
import { validate } from '../../shared/http/middleware/validate';
import { testVersionController } from './test-version.controller';
import { startPublisherSchema } from './test-version.schemas';

export const testVersionRouter = Router();

testVersionRouter.use(authenticate);
testVersionRouter.get('/troughs', testVersionController.troughs);
testVersionRouter.get('/status', testVersionController.status);
testVersionRouter.post('/tunnel', testVersionController.openTunnel);
testVersionRouter.post('/tunnel/close', testVersionController.closeTunnel);
testVersionRouter.post('/refresh-db', testVersionController.refreshDb);
testVersionRouter.get('/intake', testVersionController.intake);
testVersionRouter.post('/intake/connect', testVersionController.connectIntake);
const operators = authorize('ADMIN', 'SUPERVISOR', 'OPERATOR', 'executive', 'operation', 'engineering');

testVersionRouter.post('/start', operators, validate({ body: startPublisherSchema }), testVersionController.start);
testVersionRouter.post('/stop', operators, testVersionController.stop);
testVersionRouter.post('/reset', operators, testVersionController.reset);

import { Router } from 'express';
import { authenticate, authenticateDevice } from '../../shared/http/middleware/auth';
import { validate } from '../../shared/http/middleware/validate';
import { telemetryController } from './telemetry.controller';
import { ingestReadingsSchema, latestQuerySchema, seriesQuerySchema } from './telemetry.schemas';

export const telemetryRouter = Router();

// IoT gateways / PLC bridges post here with the x-device-key header.
telemetryRouter.post('/readings', authenticateDevice, validate({ body: ingestReadingsSchema }), telemetryController.ingest);

telemetryRouter.get('/latest', authenticate, validate({ query: latestQuerySchema }), telemetryController.latest);
telemetryRouter.get('/series', authenticate, validate({ query: seriesQuerySchema }), telemetryController.series);

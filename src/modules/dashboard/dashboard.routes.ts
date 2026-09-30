import { Router } from 'express';
import { authenticate } from '../../shared/http/middleware/auth';
import { dashboardController } from './dashboard.controller';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.get('/overview', dashboardController.overview);

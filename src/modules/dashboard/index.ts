import type { AppModule } from '../../shared/module';
import { dashboardRouter } from './dashboard.routes';

export const dashboardModule: AppModule = {
  name: 'dashboard',
  basePath: 'dashboard',
  router: dashboardRouter,
};

import type { AppModule } from '../../shared/module';
import { scheduleEngine } from './schedule-engine';
import { schedulesRouter } from './schedules.routes';

export const schedulesModule: AppModule = {
  name: 'schedules',
  basePath: 'schedules',
  router: schedulesRouter,
  onInit: () => scheduleEngine.start(),
  onShutdown: () => scheduleEngine.stop(),
};

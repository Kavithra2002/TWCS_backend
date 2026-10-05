import type { AppModule } from '../../shared/module';
import { masterDataRouter } from './master-data.routes';

export const masterDataModule: AppModule = {
  name: 'master-data',
  basePath: 'master-data',
  router: masterDataRouter,
};

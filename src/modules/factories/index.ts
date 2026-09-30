import type { AppModule } from '../../shared/module';
import { factoriesRouter } from './factories.routes';
import { factoriesService } from './factories.service';

export const factoriesModule: AppModule = {
  name: 'factories',
  basePath: 'factories',
  router: factoriesRouter,
};

export const factoriesApi = {
  getById: factoriesService.getById.bind(factoriesService),
};

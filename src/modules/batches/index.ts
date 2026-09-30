import type { AppModule } from '../../shared/module';
import { batchesRouter } from './batches.routes';
import { batchesService } from './batches.service';

export const batchesModule: AppModule = {
  name: 'batches',
  basePath: 'batches',
  router: batchesRouter,
};

/** Public API for other modules. */
export const batchesApi = {
  listActive: batchesService.listActive.bind(batchesService),
};

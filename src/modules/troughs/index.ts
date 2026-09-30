import type { AppModule } from '../../shared/module';
import { troughsRouter } from './troughs.routes';
import { troughsService } from './troughs.service';

export const troughsModule: AppModule = {
  name: 'troughs',
  basePath: 'troughs',
  router: troughsRouter,
};

/** Public API for other modules. */
export const troughsApi = {
  listBasic: troughsService.listBasic,
  listWithLiveData: troughsService.list.bind(troughsService),
  getBasic: troughsService.getBasic.bind(troughsService),
  setStatus: troughsService.setStatus.bind(troughsService),
};

export type { TroughWithLiveData } from './troughs.service';

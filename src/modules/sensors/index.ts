import type { AppModule } from '../../shared/module';
import { sensorsRouter } from './sensors.routes';
import { sensorsService } from './sensors.service';

export const sensorsModule: AppModule = {
  name: 'sensors',
  basePath: 'sensors',
  router: sensorsRouter,
};

/** Public API for other modules. */
export const sensorsApi = {
  listAll: sensorsService.listAll,
  listByTroughIds: sensorsService.listByTroughIds,
  getCached: sensorsService.getCached,
  createDefaults: sensorsService.createDefaults,
};

export { SENSOR_DEFAULTS } from './sensor-defaults';

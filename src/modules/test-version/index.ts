import type { AppModule } from '../../shared/module';
import { testVersionRouter } from './test-version.routes';
import { testVersionService } from './test-version.service';

export const testVersionModule: AppModule = {
  name: 'test-version',
  basePath: 'test-version',
  router: testVersionRouter,
  onInit: () => testVersionService.onInit(),
  onShutdown: () => testVersionService.onShutdown(),
};

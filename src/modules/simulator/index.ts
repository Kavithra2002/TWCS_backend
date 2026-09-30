import { env } from '../../config/env';
import type { AppModule } from '../../shared/module';
import { simulator } from './simulator.service';

/** Dev-only module without routes. Enabled with ENABLE_SIMULATOR=true. */
export const simulatorModule: AppModule = {
  name: 'simulator',
  onInit: async () => {
    if (env.ENABLE_SIMULATOR) await simulator.start();
  },
  onShutdown: () => simulator.stop(),
};

import type { AppModule } from '../shared/module';
import { alertsModule } from './alerts';
import { authModule } from './auth';
import { batchesModule } from './batches';
import { dashboardModule } from './dashboard';
import { factoriesModule } from './factories';
import { masterDataModule } from './master-data';
import { schedulesModule } from './schedules';
import { sensorsModule } from './sensors';
import { simulatorModule } from './simulator';
import { telemetryModule } from './telemetry';
import { troughsModule } from './troughs';
import { usersModule } from './users';

/**
 * Module registry. Order matters for onInit: event subscribers (alerts)
 * start before producers (simulator).
 */
export const modules: AppModule[] = [
  usersModule,
  masterDataModule,
  authModule,
  factoriesModule,
  sensorsModule,
  telemetryModule,
  troughsModule,
  batchesModule,
  schedulesModule,
  alertsModule,
  dashboardModule,
  simulatorModule,
];

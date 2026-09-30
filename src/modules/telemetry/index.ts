import type { AppModule } from '../../shared/module';
import { telemetryRouter } from './telemetry.routes';
import { telemetryService } from './telemetry.service';

export const telemetryModule: AppModule = {
  name: 'telemetry',
  basePath: 'telemetry',
  router: telemetryRouter,
};

/** Public API for other modules. */
export const telemetryApi = {
  ingest: telemetryService.ingest.bind(telemetryService),
  latestMap: telemetryService.latestMap.bind(telemetryService),
  hasRecentData: telemetryService.hasRecentData,
};

export type { LatestReading } from './telemetry.service';

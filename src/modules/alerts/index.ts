import { eventBus } from '../../shared/events/event-bus';
import type { AppModule } from '../../shared/module';
import { alertsRouter } from './alerts.routes';
import { alertsService } from './alerts.service';

let unsubscribers: (() => void)[] = [];

export const alertsModule: AppModule = {
  name: 'alerts',
  basePath: 'alerts',
  router: alertsRouter,
  onInit: () => {
    unsubscribers = [
      eventBus.on('telemetry.reading.recorded', (e) => alertsService.evaluateReading(e)),
      eventBus.on('trough.status.changed', (e) => alertsService.onTroughStatusChanged(e)),
    ];
  },
  onShutdown: () => unsubscribers.forEach((off) => off()),
};

/** Public API for other modules. */
export const alertsApi = {
  countOpen: alertsService.countOpen,
  list: alertsService.list.bind(alertsService),
};

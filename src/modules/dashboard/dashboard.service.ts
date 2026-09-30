import { alertsApi } from '../alerts';
import { batchesApi } from '../batches';
import { troughsApi, type TroughWithLiveData } from '../troughs';

// Read model composed from other modules' public APIs; the dashboard owns no tables.

function average(troughs: TroughWithLiveData[], type: string) {
  const values = troughs.flatMap((t) =>
    t.sensors.filter((s) => s.type === type && s.latest).map((s) => s.latest!.value),
  );
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export const dashboardService = {
  async overview() {
    const [troughs, activeBatches, openAlerts, recentAlerts] = await Promise.all([
      troughsApi.listWithLiveData({}),
      batchesApi.listActive(),
      alertsApi.countOpen(),
      alertsApi.list({ status: 'open', limit: 8 }),
    ]);

    const running = troughs.filter((t) => t.status === 'RUNNING');
    const countByStatus = (status: string) => troughs.filter((t) => t.status === status).length;

    return {
      generatedAt: new Date().toISOString(),
      kpis: {
        troughs: {
          total: troughs.length,
          running: running.length,
          idle: countByStatus('IDLE'),
          maintenance: countByStatus('MAINTENANCE'),
          offline: countByStatus('OFFLINE'),
        },
        averages: {
          airTemperature: average(running, 'AIR_TEMPERATURE'),
          leafTemperature: average(running, 'LEAF_TEMPERATURE'),
          humidity: average(running, 'HUMIDITY'),
          leafMoisture: average(running, 'LEAF_MOISTURE'),
        },
        activeBatches: activeBatches.length,
        leafInProcessKg: activeBatches.reduce((sum, b) => sum + b.leafIntakeKg, 0),
        openAlerts,
      },
      troughs: troughs.map((t) => ({
        ...t,
        activeBatch: activeBatches.find((b) => b.troughId === t.id) ?? null,
      })),
      recentAlerts,
    };
  },
};

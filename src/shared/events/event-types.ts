/**
 * Domain events exchanged between modules.
 * Payloads are plain data so `shared/` never depends on module internals.
 */
export interface ReadingRecordedEvent {
  sensorId: string;
  troughId: string;
  type: string;
  unit: string;
  value: number;
  recordedAt: string;
}

export interface AlertRaisedEvent {
  id: string;
  troughId: string;
  sensorId: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  value: number | null;
  createdAt: string;
}

export interface DomainEvents {
  'telemetry.reading.recorded': ReadingRecordedEvent;
  'alert.raised': AlertRaisedEvent;
  'alert.acknowledged': { id: string; acknowledgedById: string };
  'trough.status.changed': { troughId: string; status: string };
  'batch.changed': { batchId: string; troughId: string; status: string };
  'schedule.triggered': { scheduleId: string; troughId: string; action: string; phase: 'start' | 'end'; at: string };
}

export type DomainEventName = keyof DomainEvents;

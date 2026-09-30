import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../../config/env';
import { eventBus } from '../../shared/events/event-bus';
import { logger } from '../../shared/logger';
import { localNow } from './local-time';
import { schedulesRepository } from './schedules.repository';

let task: ScheduledTask | null = null;

/**
 * Runs every minute and fires `schedule.triggered` when a schedule's start or
 * end time is reached. This is where commands to PLCs / relay controllers
 * (fans, heaters, dampers) should be dispatched once hardware is integrated.
 */
async function tick() {
  const now = new Date();
  const { hhmm, weekday } = localNow(env.TIMEZONE, now);
  const schedules = await schedulesRepository.listEnabled();

  for (const s of schedules) {
    if (!s.daysOfWeek.includes(weekday)) continue;
    const phase = s.startTime === hhmm ? 'start' : s.endTime === hhmm ? 'end' : null;
    if (!phase) continue;

    logger.info({ schedule: s.name, troughId: s.troughId, action: s.action, phase }, 'Schedule triggered');
    if (phase === 'start') await schedulesRepository.markRun(s.id, now);
    eventBus.emit('schedule.triggered', {
      scheduleId: s.id,
      troughId: s.troughId,
      action: s.action,
      phase,
      at: now.toISOString(),
    });
  }
}

export const scheduleEngine = {
  start() {
    task = cron.schedule('* * * * *', () => {
      tick().catch((err) => logger.error({ err }, 'Schedule engine tick failed'));
    });
    logger.info(`Schedule engine running (time zone ${env.TIMEZONE})`);
  },
  stop() {
    task?.stop();
    task = null;
  },
};

import type { Schedule } from '@prisma/client';
import { env } from '../../config/env';
import { notFound } from '../../shared/http/errors';
import { troughsApi } from '../troughs';
import { localNow } from './local-time';
import { schedulesRepository } from './schedules.repository';
import type { CreateScheduleInput, ListSchedulesQuery, UpdateScheduleInput } from './schedules.schemas';

async function withTroughCodes(schedules: Schedule[]) {
  const troughs = await troughsApi.listBasic();
  const codes = new Map(troughs.map((t) => [t.id, t.code]));
  return schedules.map((s) => ({ ...s, troughCode: codes.get(s.troughId) ?? null }));
}

export const schedulesService = {
  async list(query: ListSchedulesQuery) {
    return withTroughCodes(await schedulesRepository.list(query.troughId));
  },

  /** Today's enabled schedules with their state relative to the factory's local time. */
  async today() {
    const { hhmm, weekday } = localNow(env.TIMEZONE);
    const schedules = (await schedulesRepository.listEnabled()).filter((s) => s.daysOfWeek.includes(weekday));
    const enriched = await withTroughCodes(schedules);
    return {
      now: hhmm,
      weekday,
      timeZone: env.TIMEZONE,
      items: enriched
        .map((s) => ({
          ...s,
          state: hhmm < s.startTime ? 'UPCOMING' : hhmm >= s.endTime ? 'DONE' : 'ACTIVE',
        }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    };
  },

  async getById(id: string) {
    const schedule = await schedulesRepository.findById(id);
    if (!schedule) throw notFound('Schedule');
    return schedule;
  },

  async create(input: CreateScheduleInput) {
    await troughsApi.getBasic(input.troughId);
    return schedulesRepository.create(input);
  },

  async update(id: string, input: UpdateScheduleInput) {
    await this.getById(id);
    return schedulesRepository.update(id, input);
  },

  async remove(id: string) {
    await this.getById(id);
    await schedulesRepository.delete(id);
  },
};

import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

export const schedulesRepository = {
  list: (troughId?: string) =>
    prisma.schedule.findMany({ where: { troughId }, orderBy: [{ troughId: 'asc' }, { startTime: 'asc' }] }),
  listEnabled: () => prisma.schedule.findMany({ where: { enabled: true } }),
  findById: (id: string) => prisma.schedule.findUnique({ where: { id } }),
  create: (data: Prisma.ScheduleUncheckedCreateInput) => prisma.schedule.create({ data }),
  update: (id: string, data: Prisma.ScheduleUpdateInput) => prisma.schedule.update({ where: { id }, data }),
  delete: (id: string) => prisma.schedule.delete({ where: { id } }),
  markRun: (id: string, at: Date) => prisma.schedule.update({ where: { id }, data: { lastRunAt: at } }),
};

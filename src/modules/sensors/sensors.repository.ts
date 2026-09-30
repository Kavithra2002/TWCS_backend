import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

export const sensorsRepository = {
  listAll: () => prisma.sensor.findMany({ orderBy: [{ troughId: 'asc' }, { type: 'asc' }] }),
  listByTroughIds: (troughIds: string[]) =>
    prisma.sensor.findMany({ where: { troughId: { in: troughIds } }, orderBy: { type: 'asc' } }),
  findById: (id: string) => prisma.sensor.findUnique({ where: { id } }),
  update: (id: string, data: Prisma.SensorUpdateInput) => prisma.sensor.update({ where: { id }, data }),
  createMany: (data: Prisma.SensorCreateManyInput[]) => prisma.sensor.createMany({ data, skipDuplicates: true }),
};

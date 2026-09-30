import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import type { ListTroughsQuery } from './troughs.schemas';

export const troughsRepository = {
  list: (filter: ListTroughsQuery = {}) =>
    prisma.trough.findMany({
      where: { factoryId: filter.factoryId, status: filter.status },
      orderBy: { code: 'asc' },
    }),
  findById: (id: string) => prisma.trough.findUnique({ where: { id } }),
  create: (data: Prisma.TroughUncheckedCreateInput) => prisma.trough.create({ data }),
  update: (id: string, data: Prisma.TroughUpdateInput) => prisma.trough.update({ where: { id }, data }),
};

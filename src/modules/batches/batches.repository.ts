import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import type { ListBatchesQuery } from './batches.schemas';

function rangeFilter(from?: Date, to?: Date): Prisma.DateTimeNullableFilter | Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

export const batchesRepository = {
  list: (filter: ListBatchesQuery) => {
    const window = rangeFilter(filter.from, filter.to);
    const where: Prisma.BatchWhereInput = {
      troughId: filter.troughId,
      status: filter.status,
    };

    if (window) {
      where.OR = [
        { startedAt: window },
        { endedAt: window },
        { plannedStartAt: window },
        { AND: [{ status: 'PLANNED' }, { createdAt: window as Prisma.DateTimeFilter }] },
      ];
    }

    return prisma.batch.findMany({
      where,
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      take: filter.limit,
    });
  },
  listActive: () => prisma.batch.findMany({ where: { status: 'WITHERING' }, orderBy: { startedAt: 'asc' } }),
  findById: (id: string) => prisma.batch.findUnique({ where: { id } }),
  findActiveByTrough: (troughId: string) => prisma.batch.findFirst({ where: { troughId, status: 'WITHERING' } }),
  create: (data: Prisma.BatchUncheckedCreateInput) => prisma.batch.create({ data }),
  update: (id: string, data: Prisma.BatchUpdateInput) => prisma.batch.update({ where: { id }, data }),
};

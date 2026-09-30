import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import type { ListBatchesQuery } from './batches.schemas';

export const batchesRepository = {
  list: (filter: ListBatchesQuery) =>
    prisma.batch.findMany({
      where: { troughId: filter.troughId, status: filter.status },
      orderBy: { createdAt: 'desc' },
      take: filter.limit,
    }),
  listActive: () => prisma.batch.findMany({ where: { status: 'WITHERING' }, orderBy: { startedAt: 'asc' } }),
  findById: (id: string) => prisma.batch.findUnique({ where: { id } }),
  findActiveByTrough: (troughId: string) => prisma.batch.findFirst({ where: { troughId, status: 'WITHERING' } }),
  create: (data: Prisma.BatchUncheckedCreateInput) => prisma.batch.create({ data }),
  update: (id: string, data: Prisma.BatchUpdateInput) => prisma.batch.update({ where: { id }, data }),
};

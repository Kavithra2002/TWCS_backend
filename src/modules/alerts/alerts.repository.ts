import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import type { ListAlertsQuery } from './alerts.schemas';

export const alertsRepository = {
  list: (filter: ListAlertsQuery) =>
    prisma.alert.findMany({
      where: {
        troughId: filter.troughId,
        severity: filter.severity,
        acknowledged: filter.status === 'all' ? undefined : filter.status === 'acknowledged',
      },
      orderBy: { createdAt: 'desc' },
      take: filter.limit,
      include: { acknowledgedBy: { select: { id: true, name: true } } },
    }),
  countOpen: () => prisma.alert.count({ where: { acknowledged: false } }),
  findById: (id: string) => prisma.alert.findUnique({ where: { id } }),
  create: (data: Prisma.AlertUncheckedCreateInput) => prisma.alert.create({ data }),
  acknowledge: (id: string, userId: string) =>
    prisma.alert.update({
      where: { id },
      data: { acknowledged: true, acknowledgedById: userId, acknowledgedAt: new Date() },
    }),
};

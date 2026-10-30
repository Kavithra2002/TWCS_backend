import { asyncHandler } from '../../shared/http/async-handler';
import { notFound } from '../../shared/http/errors';
import { parsedQuery } from '../../shared/http/schemas';
import { troughsService } from './troughs.service';
import type { ListTroughsQuery } from './troughs.schemas';

/** General managers only receive the troughs saved on their executive setup. */
async function assignedTroughIds(user: Express.Request['user']): Promise<Set<string> | null> {
  if (!user || user.role !== 'executive') return null;
  const { usersApi } = await import('../users');
  const profile = await usersApi.getById(user.id);
  const config = profile.executiveConfig;
  if (!config || config.designation !== 'general_manager') return null;
  return new Set(config.troughIds);
}

async function assertVisible(user: Express.Request['user'], troughId: string) {
  const allowed = await assignedTroughIds(user);
  if (allowed && !allowed.has(troughId)) throw notFound('Trough');
}

export const troughsController = {
  list: asyncHandler(async (req, res) => {
    const rows = await troughsService.list(parsedQuery<ListTroughsQuery>(req.query));
    const allowed = await assignedTroughIds(req.user);
    res.json(allowed ? rows.filter((row) => allowed.has(row.id)) : rows);
  }),

  get: asyncHandler(async (req, res) => {
    await assertVisible(req.user, req.params.id);
    res.json(await troughsService.getById(req.params.id));
  }),

  create: asyncHandler(async (req, res) => {
    res.status(201).json(await troughsService.create(req.body));
  }),

  update: asyncHandler(async (req, res) => {
    await assertVisible(req.user, req.params.id);
    res.json(await troughsService.update(req.params.id, req.body));
  }),

  setStatus: asyncHandler(async (req, res) => {
    await assertVisible(req.user, req.params.id);
    res.json(await troughsService.setStatus(req.params.id, req.body.status));
  }),
};

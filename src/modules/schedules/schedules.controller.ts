import { asyncHandler } from '../../shared/http/async-handler';
import { parsedQuery } from '../../shared/http/schemas';
import { schedulesService } from './schedules.service';
import type { ListSchedulesQuery } from './schedules.schemas';

export const schedulesController = {
  list: asyncHandler(async (req, res) => {
    res.json(await schedulesService.list(parsedQuery<ListSchedulesQuery>(req.query)));
  }),

  today: asyncHandler(async (_req, res) => {
    res.json(await schedulesService.today());
  }),

  get: asyncHandler(async (req, res) => {
    res.json(await schedulesService.getById(req.params.id));
  }),

  create: asyncHandler(async (req, res) => {
    res.status(201).json(await schedulesService.create(req.body));
  }),

  update: asyncHandler(async (req, res) => {
    res.json(await schedulesService.update(req.params.id, req.body));
  }),

  remove: asyncHandler(async (req, res) => {
    await schedulesService.remove(req.params.id);
    res.status(204).end();
  }),
};

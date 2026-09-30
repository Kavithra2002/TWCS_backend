import { asyncHandler } from '../../shared/http/async-handler';
import { parsedQuery } from '../../shared/http/schemas';
import { troughsService } from './troughs.service';
import type { ListTroughsQuery } from './troughs.schemas';

export const troughsController = {
  list: asyncHandler(async (req, res) => {
    res.json(await troughsService.list(parsedQuery<ListTroughsQuery>(req.query)));
  }),

  get: asyncHandler(async (req, res) => {
    res.json(await troughsService.getById(req.params.id));
  }),

  create: asyncHandler(async (req, res) => {
    res.status(201).json(await troughsService.create(req.body));
  }),

  update: asyncHandler(async (req, res) => {
    res.json(await troughsService.update(req.params.id, req.body));
  }),

  setStatus: asyncHandler(async (req, res) => {
    res.json(await troughsService.setStatus(req.params.id, req.body.status));
  }),
};

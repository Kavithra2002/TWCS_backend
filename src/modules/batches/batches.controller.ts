import { asyncHandler } from '../../shared/http/async-handler';
import { parsedQuery } from '../../shared/http/schemas';
import { batchesService } from './batches.service';
import type { ListBatchesQuery } from './batches.schemas';

export const batchesController = {
  list: asyncHandler(async (req, res) => {
    res.json(await batchesService.list(parsedQuery<ListBatchesQuery>(req.query)));
  }),

  get: asyncHandler(async (req, res) => {
    res.json(await batchesService.getById(req.params.id));
  }),

  create: asyncHandler(async (req, res) => {
    res.status(201).json(await batchesService.create(req.body));
  }),

  start: asyncHandler(async (req, res) => {
    res.json(await batchesService.start(req.params.id));
  }),

  complete: asyncHandler(async (req, res) => {
    res.json(await batchesService.complete(req.params.id, req.body));
  }),

  abort: asyncHandler(async (req, res) => {
    res.json(await batchesService.abort(req.params.id, req.body));
  }),
};

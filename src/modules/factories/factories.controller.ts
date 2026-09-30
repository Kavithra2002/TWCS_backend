import { asyncHandler } from '../../shared/http/async-handler';
import { factoriesService } from './factories.service';

export const factoriesController = {
  list: asyncHandler(async (_req, res) => {
    res.json(await factoriesService.list());
  }),

  get: asyncHandler(async (req, res) => {
    res.json(await factoriesService.getById(req.params.id));
  }),

  create: asyncHandler(async (req, res) => {
    res.status(201).json(await factoriesService.create(req.body));
  }),

  update: asyncHandler(async (req, res) => {
    res.json(await factoriesService.update(req.params.id, req.body));
  }),
};

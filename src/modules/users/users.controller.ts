import { asyncHandler } from '../../shared/http/async-handler';
import { usersService } from './users.service';

export const usersController = {
  list: asyncHandler(async (_req, res) => {
    res.json(await usersService.list());
  }),

  create: asyncHandler(async (req, res) => {
    res.status(201).json(await usersService.create(req.body));
  }),

  update: asyncHandler(async (req, res) => {
    res.json(await usersService.update(req.params.id, req.body));
  }),
};

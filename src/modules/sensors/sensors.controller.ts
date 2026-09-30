import { asyncHandler } from '../../shared/http/async-handler';
import { parsedQuery } from '../../shared/http/schemas';
import { sensorsService } from './sensors.service';
import type { ListSensorsQuery } from './sensors.schemas';

export const sensorsController = {
  list: asyncHandler(async (req, res) => {
    res.json(await sensorsService.list(parsedQuery<ListSensorsQuery>(req.query)));
  }),

  get: asyncHandler(async (req, res) => {
    res.json(await sensorsService.getById(req.params.id));
  }),

  update: asyncHandler(async (req, res) => {
    res.json(await sensorsService.update(req.params.id, req.body));
  }),
};

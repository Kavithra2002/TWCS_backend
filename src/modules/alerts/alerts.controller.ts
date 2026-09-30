import { asyncHandler } from '../../shared/http/async-handler';
import { parsedQuery } from '../../shared/http/schemas';
import { alertsService } from './alerts.service';
import type { ListAlertsQuery } from './alerts.schemas';

export const alertsController = {
  list: asyncHandler(async (req, res) => {
    res.json(await alertsService.list(parsedQuery<ListAlertsQuery>(req.query)));
  }),

  acknowledge: asyncHandler(async (req, res) => {
    res.json(await alertsService.acknowledge(req.params.id, req.user!.id));
  }),
};

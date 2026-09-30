import { asyncHandler } from '../../shared/http/async-handler';
import { dashboardService } from './dashboard.service';

export const dashboardController = {
  overview: asyncHandler(async (_req, res) => {
    res.json(await dashboardService.overview());
  }),
};

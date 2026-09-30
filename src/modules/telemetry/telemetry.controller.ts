import { asyncHandler } from '../../shared/http/async-handler';
import { parsedQuery } from '../../shared/http/schemas';
import { telemetryService } from './telemetry.service';
import type { LatestQuery, SeriesQuery } from './telemetry.schemas';

export const telemetryController = {
  ingest: asyncHandler(async (req, res) => {
    res.status(202).json(await telemetryService.ingest(req.body.readings));
  }),

  latest: asyncHandler(async (req, res) => {
    res.json(await telemetryService.latest(parsedQuery<LatestQuery>(req.query)));
  }),

  series: asyncHandler(async (req, res) => {
    res.json(await telemetryService.series(parsedQuery<SeriesQuery>(req.query)));
  }),
};

import { asyncHandler } from '../../shared/http/async-handler';
import { testVersionService } from './test-version.service';
import type { StartPublisherBody } from './test-version.schemas';

export const testVersionController = {
  troughs: asyncHandler(async (_req, res) => {
    res.json(testVersionService.listTroughs());
  }),

  status: asyncHandler(async (_req, res) => {
    res.json(testVersionService.getStatus());
  }),

  start: asyncHandler(async (req, res) => {
    const body = req.body as StartPublisherBody;
    res.json(await testVersionService.start(body.troughId));
  }),

  stop: asyncHandler(async (_req, res) => {
    res.json(testVersionService.stop());
  }),

  reset: asyncHandler(async (_req, res) => {
    res.json(await testVersionService.reset());
  }),

  refreshDb: asyncHandler(async (_req, res) => {
    res.json(await testVersionService.refreshDb());
  }),
};

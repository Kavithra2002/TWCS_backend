import { asyncHandler } from '../../shared/http/async-handler';
import { masterDataService } from './master-data.service';

export const masterDataController = {
  list: asyncHandler(async (_req, res) => {
    res.json(await masterDataService.list());
  }),

  createScreen: asyncHandler(async (req, res) => {
    res.status(201).json(await masterDataService.createScreen(req.body));
  }),

  deleteScreen: asyncHandler(async (req, res) => {
    await masterDataService.deleteScreen(req.params.id);
    res.status(204).end();
  }),

  createView: asyncHandler(async (req, res) => {
    res.status(201).json(await masterDataService.createView(req.params.id, req.body));
  }),

  deleteView: asyncHandler(async (req, res) => {
    await masterDataService.deleteView(req.params.id, req.params.viewId);
    res.status(204).end();
  }),

  assignScreens: asyncHandler(async (req, res) => {
    res.json(await masterDataService.assignScreens(req.params.userId, req.body));
  }),
};

import type { Router } from 'express';

/**
 * Contract every business module implements.
 * Routers are mounted at /api/v1/<basePath>.
 */
export interface AppModule {
  name: string;
  basePath?: string;
  router?: Router;
  /** Called once after the HTTP server starts (subscribe to events, start jobs). */
  onInit?: () => void | Promise<void>;
  /** Called on graceful shutdown (stop timers, jobs). */
  onShutdown?: () => void | Promise<void>;
}

import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().min(1) });

/** Cast helper for handlers: `validate()` has already parsed req.query with the schema. */
export const parsedQuery = <T>(query: unknown) => query as T;

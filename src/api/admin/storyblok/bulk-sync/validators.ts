import { z } from "zod";

export const SbBulkSyncBodySchema = z.object({
  products_ids: z.array(z.string()).optional(),
  all: z.coerce.boolean().optional(),
});

export type SbBulkSyncBody = z.infer<typeof SbBulkSyncBodySchema>;

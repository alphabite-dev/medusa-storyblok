import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SbBulkSyncBody } from "./validators";

export const POST = (req: MedusaRequest<SbBulkSyncBody>, res: MedusaResponse) => {
  const { all, products_ids } = req.validatedBody;
  const eventBus = req.scope.resolve("event_bus");

  if (!all && !products_ids?.length) {
    return res.status(400).json({ message: "Either 'all' must be true or 'products_ids' must be provided." });
  }

  if (all) {
    eventBus.emit({ name: "storyblok.bulk_sync", data: { all: true, products_ids: [] } });

    return;
  }

  eventBus.emit({ name: "storyblok.bulk_sync", data: { all: false, products_ids } });

  return res.status(200).json({ message: "Bulk sync initiated." });
};

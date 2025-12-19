import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";

export const POST = async (
  req: MedusaRequest<{ all?: boolean; product_ids?: string[] }>,
  res: MedusaResponse
) => {
  const container = req.scope;
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const { all = false, product_ids = [] } = req.body;

  try {
    await container.resolve("eventBusModuleService").emit("storyblok.bulk_force_sync", {
      all,
      product_ids,
    });

    logger.info("✅ Bulk force sync event emitted");
    return res.status(200).json({ message: "Bulk force sync initiated" });
  } catch (err) {
    logger.error("🔥 Failed to emit bulk force sync event", err);
    return res.status(500).end();
  }
};


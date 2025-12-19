import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { forceSyncSbProductWorkflow, forceSyncSbProductVariantsWorkflow } from "../../workflows";

export default async function forceSyncSbProducts({
  event: { data },
  container,
}: SubscriberArgs<{ all: boolean; product_ids: string[] }>) {
  const logger = container.resolve("logger");
  const query = container.resolve("query");
  logger.info("✅ Bulk force sync detected, force syncing with Storyblok...");

  const productsToSync = await query.graph({
    entity: "product",
    fields: ["id", "variants.id"],
    ...(!data?.all && {
      filters: {
        id: data.product_ids,
      },
    }),
  });

  for (const product of productsToSync.data) {
    try {
      await forceSyncSbProductWorkflow(container).run({
        input: { product_id: product.id },
      });

      if (product.variants && product.variants.length > 0) {
        logger.info(`Force syncing ${product.variants.length} variants for product: ${product.id}`);
        await forceSyncSbProductVariantsWorkflow(container).run({
          input: {
            product_id: product.id,
            variant_ids: product.variants.map((v: any) => v.id),
          },
        });
      }
    } catch (error) {
      logger.error("❌ Error force syncing product with Storyblok: " + product.id, error);
    }
  }
}

export const config: SubscriberConfig = {
  event: ["storyblok.bulk_force_sync"],
};


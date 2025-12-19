import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { createSbProductWorkflow, createSbProductVariantsWorkflow } from "../../workflows";

export default async function createSbProduct({
  event: { data },
  container,
}: SubscriberArgs<{ all: boolean; products_ids: string[] }>) {
  const logger = container.resolve("logger");
  const query = container.resolve("query");
  logger.info("✅ Bulk sync detected, syncing with Storyblok...");

  const productsToSync = await query.graph({
    entity: "product",
    fields: ["id", "variants.id"],
    ...(!data?.all && {
      filters: {
        id: data.all ? undefined : data.products_ids,
      },
    }),
  });

  for (const product of productsToSync.data) {
    try {
      // Create product story
      await createSbProductWorkflow(container).run({
        input: { product_id: product.id },
      });

      // Create variants if they exist
      if (product.variants && product.variants.length > 0) {
        logger.info(`Syncing ${product.variants.length} variants for product: ${product.id}`);
        await createSbProductVariantsWorkflow(container).run({
          input: {
            product_id: product.id,
            variant_ids: product.variants.map((v: any) => v.id),
          },
        });
      }
    } catch (error) {
      logger.error("❌ Error syncing product with Storyblok: " + product.id, error);
    }
  }
}

export const config: SubscriberConfig = {
  event: ["storyblok.bulk_sync"],
};

import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { createSbProductVariantsWorkflow } from "../../workflows";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export default async function updateStoryblokProduct({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  logger.info("✅ Product variant changes detected, syncing with Storyblok...");

  // Wait 5 seconds to ensure product story is created first
  await new Promise((resolve) => setTimeout(resolve, 5000));
  logger.info("Proceeding with variant sync after delay...");

  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "title", "product_id", "thumbnail", "images.url"],
    filters: {
      id: data.id,
    },
  });

  await createSbProductVariantsWorkflow(container).run({
    input: { product_id: variants[0].product_id, variant_ids: [data.id] },
  });
}

export const config: SubscriberConfig = {
  event: ["product-variant.created"],
};

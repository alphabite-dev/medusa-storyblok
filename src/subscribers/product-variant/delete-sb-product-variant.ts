import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { deleteSbProductVariantWorkflow } from "../../workflows";

export default async function updateStoryblokProduct({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");
  logger.info("✅ Product variant changes detected, syncing with Storyblok...");

  console.log({
    variant_id: data.id,
  });

  await deleteSbProductVariantWorkflow(container).run({
    input: { variant_id: data.id },
  });
}

export const config: SubscriberConfig = {
  event: ["product-variant.deleted"],
};

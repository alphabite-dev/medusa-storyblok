import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { createSbProductVariantWorkflow } from "../../workflows";

export default async function updateStoryblokProduct({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");
  logger.info("✅ Product variant changes detected, syncing with Storyblok...");

  console.log({
    variant_id: data.id,
  });

  await createSbProductVariantWorkflow(container).run({
    input: { variant_id: data.id },
  });
}

export const config: SubscriberConfig = {
  event: ["product-variant.created"],
};

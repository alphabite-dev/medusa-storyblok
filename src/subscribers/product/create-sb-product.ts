import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { createSbProductWorkflow } from "../../workflows";

export default async function createSbProduct({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");
  logger.info("✅ Product create detected, syncing with Storyblok...");

  await createSbProductWorkflow(container).run({
    input: { product_id: data.id },
  });
}

export const config: SubscriberConfig = {
  event: ["product.created"],
};

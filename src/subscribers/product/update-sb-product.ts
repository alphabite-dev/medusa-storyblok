import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { updateSbProductWorkflow } from "../../workflows";

export default async function updateSbProduct({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");
  logger.info("✅ Product update detected, syncing with Storyblok...");

  await updateSbProductWorkflow(container).run({
    input: { product_id: data.id },
  });
}

export const config: SubscriberConfig = {
  event: ["product.updated"],
};

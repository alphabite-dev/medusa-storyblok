import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { deleteSbProductWorkflow } from "../../workflows";

export default async function deleteSbProduct({
  event: { data },
  container,
}: SubscriberArgs<{
  id: string;
}>) {
  const logger = container.resolve("logger");

  await deleteSbProductWorkflow(container).run({
    input: { product_id: data.id },
  });

  logger.info("✅ Sb  Product story deleted...");
}

export const config: SubscriberConfig = {
  event: ["product.deleted"],
};

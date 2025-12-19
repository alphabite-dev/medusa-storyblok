import { ContainerRegistrationKeys, MedusaError } from "@medusajs/utils";
import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { STORYBLOK_MODULE } from "../../../../modules/storyblok";
import StoryblokModuleService from "../../../../modules/storyblok/service";

export type ForceSyncSbProductStepInput = {
  product_id: string;
};

export const forceSyncSbProductStep = createStep(
  {
    name: "force-sync-sb-product",
  },
  async ({ product_id }: ForceSyncSbProductStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const storyblok = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);

    logger.info("Force syncing Storyblok with Medusa product...");

    const { data } = await query.graph({
      entity: "product",
      filters: { id: product_id },
      fields: ["id", "title", "handle", "thumbnail", "images.url"],
    });

    const product = data?.[0];

    if (!product) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Product with id ${product_id} not found`);
    }

    const forceSyncedProduct = await storyblok.forceSyncProductStory(product);

    return new StepResponse(forceSyncedProduct);
  },

  async (rollbackData, { container }) => {
    // No rollback needed for force sync
  }
);


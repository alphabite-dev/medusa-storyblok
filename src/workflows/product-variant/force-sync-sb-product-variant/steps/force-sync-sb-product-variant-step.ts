import { ContainerRegistrationKeys, MedusaError } from "@medusajs/utils";
import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { STORYBLOK_MODULE } from "../../../../modules/storyblok";
import StoryblokModuleService from "../../../../modules/storyblok/service";

export type ForceSyncSbProductVariantStepInput = {
  product_id: string;
  variant_ids: string[];
};

export const forceSyncSbProductVariantStep = createStep(
  {
    name: "force-sync-sb-product-variant",
  },
  async ({ product_id, variant_ids }: ForceSyncSbProductVariantStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const storyblok = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);

    logger.info("Force syncing Storyblok with Medusa product variants...");

    const { data: variants } = await query.graph({
      entity: "product_variant",
      fields: ["id", "title", "product_id", "thumbnail", "images.url"],
      filters: {
        id: variant_ids,
      },
    });

    if (!variants || variants.length === 0) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Product variants not found`);
    }

    await storyblok.forceSyncProductVariants({
      productId: product_id,
      productVariants: variants,
    });

    logger.info(`✅ Storyblok product variants force synced for product id: ${product_id}`);

    return new StepResponse({});
  },

  async (rollbackData, { container }) => {
    // No rollback needed for force sync
  }
);


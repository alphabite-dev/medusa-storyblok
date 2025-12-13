import { ContainerRegistrationKeys, promiseAll } from "@medusajs/utils";
import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { STORYBLOK_MODULE } from "../../../../modules/storyblok";
import StoryblokModuleService from "../../../../modules/storyblok/service";

export type DeleteSbProductVariantStepInput = {
  variant_id: string;
};

export const deleteSbProductVariantStep = createStep(
  {
    name: "delete-sb-product-variant",
  },
  async ({ variant_id }: DeleteSbProductVariantStepInput, { container }) => {
    const sbModuleService = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

    logger.info("Syncing Storyblok with Medusa products...");

    const { data } = await query.graph({
      entity: "product",
      filters: { variants: { id: variant_id } },
      fields: ["id", "handle", "variants.id"],
    });

    const product = data[0];
    if (!product) {
      logger.warn(`❌ No product found for variant_id: ${variant_id}`);
      return StepResponse.permanentFailure();
    }

    const updatedStory = await sbModuleService.deleteProductVariant({
      product_id: product.id,
      product_variant_id: variant_id,
    });

    // Update Sb story record in the medusa database

    return new StepResponse(updatedStory);
  },

  async (rollbackData, { container }) => {
    if (!rollbackData) return;

    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

    logger.warn("🔁 Storyblok update variants rollback started...");
  }
);

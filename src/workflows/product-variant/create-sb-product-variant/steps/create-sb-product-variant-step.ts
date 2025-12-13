import { ContainerRegistrationKeys, promiseAll } from "@medusajs/utils";
import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { STORYBLOK_MODULE } from "../../../../modules/storyblok";
import StoryblokModuleService from "../../../../modules/storyblok/service";
import { ProductVariantDTO } from "@medusajs/types";

export type CreateSbProductVariantStepInput = {
  variant_id: string;
};

export const createSbProductVariantStep = createStep(
  {
    name: "create-sb-product-variant",
  },
  async ({ variant_id }: CreateSbProductVariantStepInput, { container }) => {
    const sbModuleService = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

    logger.info("Syncing Storyblok with Medusa products...");

    const { data } = await query.graph({
      entity: "product",
      filters: { variants: { id: variant_id } },
      fields: ["id", "handle", "variants.title", "variants.id", "variants.metadata"],
    });

    const product = data[0];
    if (!product) {
      logger.warn(`❌ No product found for variant_id: ${variant_id}`);
      return StepResponse.permanentFailure();
    }

    const variants = product.variants;

    const variant = variants.find((v) => v.id === variant_id);

    if (!variant) {
      logger.warn(`❌ Variant ${variant_id} not found for product id: ${product.id}`);
      return StepResponse.permanentFailure();
    }

    const updatedStory = await sbModuleService.createProductVariant({
      productId: product.id,
      productVariant: variant as ProductVariantDTO,
    });

    logger.info(
      `✅ Storyblok synced for product id: ${product.id}, variant id: ${variant_id}, slug: ${product.handle}`
    );

    return new StepResponse(updatedStory);
  },

  async (rollbackData, { container }) => {
    if (!rollbackData) return;

    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

    logger.warn("🔁 Storyblok update variants rollback started...");
  }
);

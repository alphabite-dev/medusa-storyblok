import { ContainerRegistrationKeys, promiseAll } from "@medusajs/utils";
import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { STORYBLOK_MODULE } from "../../../../modules/storyblok";
import StoryblokModuleService from "../../../../modules/storyblok/service";
import { ProductVariantDTO } from "@medusajs/types";

export type CreateSbProductVariantStepInput = {
  product: {
    id: string;
    handle: string;
  };
  variants: {
    id: string;
    title: string;
    metadata?: Record<string, any>;
  }[];
};

export const createSbProductVariantsStep = createStep(
  {
    name: "create-sb-product-variant",
  },
  async ({ product, variants }: CreateSbProductVariantStepInput, { container }) => {
    const sbModuleService = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    logger.info("Syncing Storyblok with Medusa products...");

    if (!variants?.length) {
      logger.warn(`❌ No variants for product id: ${product.id}`);
      return StepResponse.permanentFailure();
    }

    // Fetch variant images
    const { data: variantsWithImages } = await query.graph({
      entity: "product_variant",
      filters: { id: variants.map((v) => v.id) },
      fields: ["id", "title", "thumbnail", "images.url"],
    });

    await sbModuleService.createProductVariant({
      productId: product.id,
      productVariants: variantsWithImages,
    });

    logger.info(`✅ Storyblok product variants synced for product id: ${product.id}, slug: ${product.handle}`);

    return new StepResponse({});
  }
);

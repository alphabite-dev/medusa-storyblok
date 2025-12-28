import { ContainerRegistrationKeys, promiseAll } from "@medusajs/utils";
import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { STORYBLOK_MODULE } from "../../../../modules/storyblok";
import StoryblokModuleService from "../../../../modules/storyblok/service";
import { batchVariantImagesWorkflow, updateProductVariantsWorkflow } from "@medusajs/core-flows";
import { UpdateProductVariantWorkflowInputDTO } from "@medusajs/types";

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

    // Sync images from Storyblok back to Medusa variants
    try {
      // Retrieve the full product story with variants
      const productStory = await sbModuleService.retrieveProductStory({
        productId: product.id,
      });

      if (productStory) {
        const mapImageUrl = sbModuleService.mapImageUrl.bind(sbModuleService);
        const variantsImagesMap = sbModuleService.buildVariantsImagesMap(productStory.content.variants || []);

        // Build mapped variants for update
        const mappedVariants: UpdateProductVariantWorkflowInputDTO[] = (productStory.content.variants || []).map(
          (v) => {
            const variantData = variantsImagesMap[v.medusaProductVariantId];
            const thumbnail = variantData?.thumbnail;
            const thumbnailAlt = thumbnail?.metadata?.alt as string | undefined;

            return {
              title: v.title,
              id: v.medusaProductVariantId,
              thumbnail: thumbnail ? thumbnail.url : null,
              ...(thumbnailAlt && {
                metadata: { thumbnail_alt: thumbnailAlt },
              }),
            };
          }
        );

        // Update variant metadata (title, thumbnail)
        await updateProductVariantsWorkflow(container).run({
          input: {
            product_variants: mappedVariants,
          },
        });

        // Sync images for each variant
        const { data: updatedProducts } = await query.graph({
          entity: "product",
          filters: { id: product.id },
          fields: ["id", "images.id", "images.url", "variants.id", "variants.images.id"],
        });

        const productImages = updatedProducts[0]?.images || [];
        const urlToImageId = new Map<string, string>();
        for (const img of productImages) {
          if (img.url && img.id) {
            urlToImageId.set(img.url, img.id);
          }
        }

        const resultVariants = updatedProducts[0]?.variants || [];

        for (const variantId of Object.keys(variantsImagesMap)) {
          const desiredData = variantsImagesMap[variantId];
          const desiredUrls = [
            ...(desiredData.thumbnail ? [desiredData.thumbnail.url] : []),
            ...desiredData.images.map((img) => img.url),
          ];
          const desiredImageIds = desiredUrls
            .map((url) => (url ? urlToImageId.get(url) : undefined))
            .filter((id): id is string => id !== undefined);

          const resultVariant = resultVariants.find((v) => v.id === variantId);
          const currentImageIds = (resultVariant?.images || [])
            .map((img) => img.id)
            .filter((id): id is string => id !== undefined);

          const add = desiredImageIds.filter((id) => !currentImageIds.includes(id));
          const remove = currentImageIds.filter((id) => !desiredImageIds.includes(id));

          if (add.length > 0 || remove.length > 0) {
            await batchVariantImagesWorkflow(container).run({
              input: {
                variant_id: variantId,
                add,
                remove,
              },
            });
          }
        }

        logger.info(`✅ Synced images from Storyblok to variants for product ${product.id}`);
      }
    } catch (err) {
      logger.error(`⚠️ Failed to sync images from Storyblok for variants of product ${product.id}`, err);
      // Don't fail the step if image sync fails
    }

    return new StepResponse({});
  }
);

import { ContainerRegistrationKeys, promiseAll } from "@medusajs/utils";
import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { STORYBLOK_MODULE } from "../../../../modules/storyblok";
import StoryblokModuleService from "../../../../modules/storyblok/service";
import { updateProductsWorkflow } from "@medusajs/core-flows";

export type CreateSbProductStepInput = {
  product_id: string;
};

export const createSbProductStep = createStep(
  {
    name: "create-sb-product",
  },
  async ({ product_id }: CreateSbProductStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const sb = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);

    logger.info("Syncing Sb with Medusa products...");

    const { data } = await query.graph({
      entity: "product",
      filters: { id: product_id },
      fields: ["id", "title", "handle", "thumbnail", "images.url"],
    });

    const product = data[0];

    const createdStory = await sb.createProductStory(product);

    // Sync images from Storyblok back to Medusa
    try {
      const mapImageUrl = sb.mapImageUrl.bind(sb);
      const { thumbnail, images } = sb.extractProductGalleryImages(createdStory.content.gallery);
      const variants = createdStory.content.variants || [];
      const variantsImagesMap = sb.buildVariantsImagesMap(variants);
      const flattenedVariantImages = sb.flattenVariantImages(variantsImagesMap);

      await updateProductsWorkflow(container).run({
        input: {
          products: [
            {
              id: product_id,
              handle: createdStory.slug,
              thumbnail: thumbnail ? mapImageUrl(thumbnail.image.filename) : null,
              metadata: {
                thumbnail_alt: thumbnail?.image.alt || "",
              },
              images: [...images, ...flattenedVariantImages],
            },
          ],
        },
      });

      logger.info(`✅ Synced images from Storyblok to product ${product_id}`);
    } catch (err) {
      logger.error(`⚠️ Failed to sync images from Storyblok for product ${product_id}`, err);
      // Don't fail the step if image sync fails
    }

    return new StepResponse({ data: createdStory });
  }
);

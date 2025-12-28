import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { StoryblokWebhookInput } from "../validators";
import { ContainerRegistrationKeys, Modules } from "@medusajs/utils";
import StoryblokModuleService from "../../../../../modules/storyblok/service";
import { STORYBLOK_MODULE } from "../../../../../modules/storyblok";
import { GalleryImageBlok, ProductVariantBlok } from "../../../../../modules/storyblok/types";
import {
  batchVariantImagesWorkflow,
  updateInventoryItemsWorkflow,
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/core-flows";
import { UpdateProductVariantWorkflowInputDTO, UpsertProductImageDTO } from "@medusajs/types";

export const POST = async (req: MedusaRequest<StoryblokWebhookInput>, res: MedusaResponse) => {
  const container = req.scope;
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const sbModuleService = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);
  const { token } = req.query;
  const webhookSecret = sbModuleService.getOptions().webhookSecret;

  if (webhookSecret && token !== webhookSecret) {
    logger.warn("Unauthorized Storyblok webhook request.");
    return res.status(401).end();
  }

  try {
    const { story_id, action } = req.body;

    if (action !== "published") {
      logger.info(`Unexpected action: ${action} for story_id: ${story_id} at update webhook endpoint.`);
      return res.status(200).end();
    }

    const productStory = await sbModuleService.retrieveProductStory({
      params: { by_ids: String(story_id) },
    });

    if (!productStory) {
      logger.warn(`No product story found for story_id: ${story_id}`);
      return res.status(500).end();
    }

    const mapImageUrl = sbModuleService.mapImageUrl.bind(sbModuleService);
    const variants = productStory.content.variants || [];

    // Extract gallery data using service helper methods
    const { thumbnail, images } = sbModuleService.extractProductGalleryImages(productStory.content.gallery);
    const variantsImagesMap = sbModuleService.buildVariantsImagesMap(variants);
    const mappedVariants = buildMappedVariants(variants, variantsImagesMap);

    // Get current product images before update to compute diff
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: currentProductData } = await query.graph({
      entity: "product",
      filters: { id: productStory.content.medusaProductId },
      fields: ["id", "images.id", "images.url"],
    });
    const currentProductImages = currentProductData[0]?.images || [];

    // Compute desired images from Storyblok (product gallery + variant images)
    const desiredImages = [...images, ...sbModuleService.flattenVariantImages(variantsImagesMap)];
    const desiredImageUrls = desiredImages.map((img) => img.url).filter((url): url is string => url !== undefined);

    // Build URL to image ID map from current images
    const urlToImageIdForProduct = buildUrlToImageIdMap(currentProductImages);

    // Compute product image diff
    const { add: productImagesToAdd, remove: productImagesToRemove } = computeProductImageDiff(
      desiredImageUrls,
      urlToImageIdForProduct,
      currentProductImages
    );

    // Update product with all images from Storyblok (this should replace all images)
    // If updateProductsWorkflow doesn't remove images, we'll handle removal separately
    const updatedProducts = await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: productStory.content.medusaProductId,
            handle: productStory.slug,
            thumbnail: thumbnail ? mapImageUrl(thumbnail.image.filename) : null,
            metadata: {
              thumbnail_alt: thumbnail?.image.alt || "",
            },
            images: desiredImages,
          },
        ],
      },
    });

    // Remove images that are no longer in Storyblok
    // If updateProductsWorkflow doesn't remove them, we need to update again with only desired images
    if (productImagesToRemove.length > 0) {
      // Get updated product images after the workflow
      const updatedProductImages = updatedProducts.result[0].images || [];
      const remainingImageIds = updatedProductImages
        .map((img) => img.id)
        .filter((id): id is string => id !== undefined);

      // Check if unwanted images are still there
      const stillPresent = productImagesToRemove.filter((id) => remainingImageIds.includes(id));

      if (stillPresent.length > 0) {
        // Update again with only desired images to force removal
        // Use the desiredImages array we computed earlier (already in the correct format)
        await updateProductsWorkflow(container).run({
          input: {
            products: [
              {
                id: productStory.content.medusaProductId,
                images: desiredImages,
              },
            ],
          },
        });

        logger.info(
          `🗑️ Removed ${stillPresent.length} deleted images from product ${productStory.content.medusaProductId}`
        );
      }
    }

    // Update variant metadata (title, thumbnail)
    await updateProductVariantsWorkflow(container).run({
      input: {
        product_variants: mappedVariants,
      },
    });

    // Sync images for each variant
    const productImages = updatedProducts.result[0].images || [];
    const urlToImageIdForVariants = buildUrlToImageIdMap(productImages);
    const resultVariants = updatedProducts.result[0].variants || [];

    for (const variantId of Object.keys(variantsImagesMap)) {
      const { add, remove } = computeVariantImageDiff(
        variantId,
        variantsImagesMap,
        urlToImageIdForVariants,
        resultVariants
      );

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

    logger.info(
      `✅ Updated product ${productStory.content.medusaProductId} from story ${story_id}, slug: ${productStory.slug}`
    );
    return res.status(200).end();
  } catch (err) {
    logger.error("🔥 Failed to process update story webhook", err);
    return res.status(500).end();
  }
};

// Types
type VariantImagesMap = Record<string, { thumbnail: UpsertProductImageDTO | null; images: UpsertProductImageDTO[] }>;

// Helper Functions (using service methods for image extraction)

function buildMappedVariants(
  variants: ProductVariantBlok[],
  variantsImagesMap: VariantImagesMap
): UpdateProductVariantWorkflowInputDTO[] {
  return variants.map((v) => {
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
  });
}

function buildUrlToImageIdMap(productImages: Array<{ url?: string; id?: string }>): Map<string, string> {
  const urlToImageId = new Map<string, string>();
  for (const img of productImages) {
    if (img.url && img.id) {
      urlToImageId.set(img.url, img.id);
    }
  }
  return urlToImageId;
}

function computeProductImageDiff(
  desiredImageUrls: string[],
  urlToImageId: Map<string, string>,
  currentProductImages: Array<{ url?: string; id?: string }>
): { add: string[]; remove: string[] } {
  const desiredImageIds = desiredImageUrls
    .map((url) => (url ? urlToImageId.get(url) : undefined))
    .filter((id): id is string => id !== undefined);

  const currentImageIds = currentProductImages.map((img) => img.id).filter((id): id is string => id !== undefined);

  const add = desiredImageIds.filter((id) => !currentImageIds.includes(id));
  const remove = currentImageIds.filter((id) => !desiredImageIds.includes(id));

  return { add, remove };
}

function computeVariantImageDiff(
  variantId: string,
  variantsImagesMap: VariantImagesMap,
  urlToImageId: Map<string, string>,
  resultVariants: Array<{ id: string; images?: Array<{ id?: string }> }>
): { add: string[]; remove: string[] } {
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

  return { add, remove };
}

// Main Handler

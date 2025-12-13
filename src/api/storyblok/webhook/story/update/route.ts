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

    // Extract gallery data
    const { thumbnail, images } = extractProductGalleryImages(productStory.content.gallery, mapImageUrl);
    const variantsImagesMap = buildVariantsImagesMap(variants, mapImageUrl);
    const mappedVariants = buildMappedVariants(variants, variantsImagesMap);

    // Update product with all images
    const updatedProducts = await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: productStory.content.medusaProductId,
            handle: productStory.slug,
            ...(!!thumbnail && { thumbnail: thumbnail.image.filename }),
            metadata: {
              ...(!!thumbnail && { thumbnail_alt: thumbnail.image.alt || "" }),
            },
            images: [...images, ...flattenVariantImages(variantsImagesMap)],
          },
        ],
      },
    });

    // Update variant metadata (title, thumbnail)
    await updateProductVariantsWorkflow(container).run({
      input: {
        product_variants: mappedVariants,
      },
    });

    // Sync images for each variant
    const productImages = updatedProducts.result[0].images || [];
    const urlToImageId = buildUrlToImageIdMap(productImages);
    const resultVariants = updatedProducts.result[0].variants || [];

    for (const variantId of Object.keys(variantsImagesMap)) {
      const { add, remove } = computeVariantImageDiff(
        variantId,
        variantsImagesMap,
        urlToImageId,
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
type VariantImagesMap = Record<
  string,
  { thumbnail: UpsertProductImageDTO | null; images: UpsertProductImageDTO[] }
>;

// Helper Functions

function extractProductGalleryImages(
  gallery: GalleryImageBlok[] | undefined,
  mapImageUrl: (url: string) => string
): { thumbnail: GalleryImageBlok | undefined; images: UpsertProductImageDTO[] } {
  const galleryImages = gallery?.filter((item) => item.component === "galleryImage") || [];
  const thumbnail = galleryImages.find((img) => img.isThumbnail);
  const images: UpsertProductImageDTO[] = galleryImages
    .filter((img) => !img.isThumbnail)
    .map((img) => ({
      url: mapImageUrl(img.image.filename),
      metadata: { alt: img.image.alt || "" },
    }));

  return { thumbnail, images };
}

function buildVariantsImagesMap(
  variants: ProductVariantBlok[],
  mapImageUrl: (url: string) => string
): VariantImagesMap {
  return variants.reduce((acc, v) => {
    const vGallery = (v.gallery || []).filter((item) => item.component === "galleryImage");
    const thumbnailImg = vGallery.find((img) => img.isThumbnail);
    const images = vGallery
      .filter((img) => !img.isThumbnail)
      .map((img) => ({
        url: mapImageUrl(img.image.filename),
        metadata: { alt: img.image.alt || "" },
      }));

    acc[v.medusaProductVariantId] = {
      thumbnail: thumbnailImg
        ? {
            url: mapImageUrl(thumbnailImg.image.filename),
            metadata: { alt: thumbnailImg.image.alt || "" },
          }
        : null,
      images,
    };

    return acc;
  }, {} as VariantImagesMap);
}

function buildMappedVariants(
  variants: ProductVariantBlok[],
  variantsImagesMap: VariantImagesMap
): UpdateProductVariantWorkflowInputDTO[] {
  return variants.map((v) => {
    const variantData = variantsImagesMap[v.medusaProductVariantId];
    const thumbnailAlt = variantData?.thumbnail?.metadata?.alt as string | undefined;
    
    return {
      title: v.title,
      id: v.medusaProductVariantId,
      thumbnail: variantData?.thumbnail?.url || undefined,
      ...(thumbnailAlt && {
        metadata: { thumbnail_alt: thumbnailAlt },
      }),
    };
  });
}

function flattenVariantImages(variantsImagesMap: VariantImagesMap): UpsertProductImageDTO[] {
  return Object.values(variantsImagesMap).flatMap((v) =>
    [v.thumbnail, ...v.images].filter((img): img is UpsertProductImageDTO => img !== null)
  );
}

function buildUrlToImageIdMap(
  productImages: Array<{ url?: string; id?: string }>
): Map<string, string> {
  const urlToImageId = new Map<string, string>();
  for (const img of productImages) {
    if (img.url && img.id) {
      urlToImageId.set(img.url, img.id);
    }
  }
  return urlToImageId;
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



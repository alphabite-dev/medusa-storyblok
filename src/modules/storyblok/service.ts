import z from "zod";
import { Logger } from "@medusajs/medusa";
import StoryblokClient, { ISbStoryData } from "storyblok-js-client";
import sizeOf from "image-size";
import {
  AlphabiteStoryblokPluginOptions,
  CreateSbProductStoryInput,
  UpdateSbProductStoryInput,
  ListSbProductsStoriesInput,
  RetrieveSbProductInput,
  DeleteSbProductInput,
  GetStoryblokStoryEditorUrlInput,
  CreateSbProductVariantInput,
  DeleteSbProductVariantInput,
  CreateSbProductStoryPayload,
  UpdateSbProductStoryPayload,
  ProductStory,
  ISbImageAsset,
  UploadImageToSbInput,
  GetOrCreateSbAssetFolderInput,
  GalleryImageBlok,
} from "./types";

import { MedusaError, MedusaService } from "@medusajs/utils";

type InjectedDependencies = {
  logger: Logger;
};

export const optionsSchema = z.object({
  accessToken: z.string(),
  version: z.enum(["draft", "published"]).optional(),
  region: z.string().optional(),
  personalAccessToken: z.string(),
  spaceId: z.string(),
  productsParentFolderId: z.string(),
  productsParentFolderName: z.string(),
  deleteProductOnSbProductStoryDelete: z.boolean().optional(),
  relations: z.array(z.string()),
  webhookSecret: z.string().optional(),
  imageOptimization: z.object({
    width: z.number().default(800),
    quality: z.number().min(1).max(100).optional(),
    mapImageUrl: z.function().optional(),
  }),
});

export default class StoryblokModuleService extends MedusaService({}) {
  private options: AlphabiteStoryblokPluginOptions;
  private storyblokClient: StoryblokClient;
  private logger: Logger;

  static validateOptions(options: AlphabiteStoryblokPluginOptions): void | never {
    const parsed = optionsSchema.safeParse(options);
    if (!parsed.success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Invalid options provided for StoryblokModuleService: ${parsed.error.message}`
      );
    }
  }

  constructor({ logger }: InjectedDependencies, options: AlphabiteStoryblokPluginOptions) {
    super(...arguments);
    this.options = options;
    this.logger = logger;

    this.storyblokClient = new StoryblokClient({
      accessToken: options.accessToken,
      region: options.region || "eu",
      oauthToken: options.personalAccessToken,
      version: options.version || "draft",
    });

    this.logger.info("Connected to Storyblok. Storyblok client initialized.");
  }

  private async create(story: any) {
    return await this.storyblokClient.post(`spaces/${this.options.spaceId}/stories`, {
      story: this.removeEditable(story),
    });
  }

  private async update(id: string | number, story: any) {
    return await this.storyblokClient.put(`spaces/${this.options.spaceId}/stories/${id.toString()}`, {
      story: this.removeEditable(story),
      force_update: "1",
    });
  }

  private async delete(id: string | number) {
    return await this.storyblokClient.delete(`spaces/${this.options.spaceId}/stories/${id.toString()}`);
  }

  async createProductStory({ id, handle, title, thumbnail, images = [] }: CreateSbProductStoryInput) {
    try {
      const slug = handle;

      // Process images using the reusable method
      const { gallery: productGallery } = await this.processProductImages({
        slug,
        thumbnail,
        images,
        title,
      });

      const story: CreateSbProductStoryPayload = {
        name: title,
        slug,
        parent_id: Number(this.options.productsParentFolderId),
        content: {
          component: "product",
          medusaProductId: id,
          title,
          ...(productGallery.length > 0 && { gallery: productGallery }),
        },
      };

      const createdStory = (await this.create(story)) as unknown as ISbStoryData<ProductStory>;

      this.logger.info(`✅ Product story created: ${slug}`);

      return createdStory;
    } catch (err) {
      this.logger.error(`❌ Failed to create story for ${title}`, err);

      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Creation failed");
    }
  }

  async updateProductStory({ id, title, handle }: UpdateSbProductStoryInput) {
    try {
      const slug = handle;

      const existingProductStory = await this.retrieveProductStory({
        productId: id,
        params: {
          version: "draft",
        },
      });

      if (!existingProductStory) {
        this.logger.error(`❌ No existing story found for slug: ${slug} & id: ${id}`);
        return;
      }

      const story: UpdateSbProductStoryPayload = {
        ...existingProductStory,
        slug,
      };

      const updatedProductStory = await this.update(existingProductStory.id.toString(), story);

      this.logger.info(`✅ Updated product story: ${slug}`);
      return updatedProductStory as unknown as ISbStoryData<ProductStory>;
    } catch (err) {
      this.logger.error(`❌ Failed to update story for ${title}`, err);
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Update failed");
    }
  }

  async deleteProductStory({ id }: DeleteSbProductInput) {
    try {
      const storyToDelete = await this.retrieveProductStory({ productId: id });

      if (!storyToDelete) {
        this.logger.warn(`⚠️ No story found for product_id: ${id}, skipping deletion.`);
        return;
      }

      const slug = storyToDelete.slug;

      // Delete the story
      const res = await this.delete(storyToDelete.id);
      this.logger.info(`🗑️  Deleted story: ${id}, slug: ${slug}`);

      // Delete the asset folder and all its contents
      try {
        await this.deleteAssetFolder({ slug });
        this.logger.info(`🗑️  Deleted asset folder: ${slug}`);
      } catch (err) {
        this.logger.error(`⚠️ Failed to delete asset folder for slug: ${slug}`, err);
        // Don't fail the whole operation if folder deletion fails
      }

      return res;
    } catch (err) {
      this.logger.error(`🔥 Failed to delete story: ${id}`, err);
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Delete failed");
    }
  }

  async listProductsStories({ products_ids, fetchOptions, params }: ListSbProductsStoriesInput) {
    try {
      const res = await this.storyblokClient.getStories(
        {
          starts_with: `${this.options.productsParentFolderName}/`,
          filter_query: { medusaProductId: { in: products_ids } },
          ...params,
        },
        fetchOptions
      );

      return res.data.stories as unknown as ISbStoryData<ProductStory>[];
    } catch (err) {
      this.logger.error("🔥 Failed to list Storyblok stories", err);
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Stories not found");
    }
  }

  async retrieveProductStory({ productId, params }: RetrieveSbProductInput) {
    try {
      const res = await this.storyblokClient.getStories({
        starts_with: `${this.options.productsParentFolderName}/`,
        ...(productId && { filter_query: { medusaProductId: { like: productId } } }),
        ...params,
      });

      return res.data.stories[0] as unknown as ISbStoryData<ProductStory>;
    } catch (err) {
      this.logger.error(`🔥 Failed to retrieve story: ${productId}`, err);
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Story not found");
    }
  }

  async createProductVariant({ productId, productVariants }: CreateSbProductVariantInput) {
    try {
      const productStory = await this.retrieveProductStory({ productId });

      if (!productStory) {
        this.logger.warn(`❌ No Storyblok story found for product id: ${productId}`);
        return;
      }

      const slug = productStory.slug;

      // Build variant bloks with image galleries
      const productVariantBloks = await Promise.all(
        productVariants.map(async (productVariant) => {
          const variantTitle = productVariant?.title || "Unnamed Variant";

          // Process variant images using the reusable method
          const { gallery: variantGallery } = await this.processProductImages({
            slug,
            thumbnail: productVariant.thumbnail,
            images: productVariant.images,
            title: variantTitle,
          });

          return {
            title: variantTitle,
            component: "productVariant",
            medusaProductVariantId: productVariant.id,
            ...(variantGallery.length > 0 && { gallery: variantGallery }),
          };
        })
      );

      const variants = [...(productStory?.content?.variants || []), ...productVariantBloks];

      const storyContent = {
        ...productStory,
        content: {
          ...productStory.content,
          variants,
        },
      };

      await this.update(productStory.id, storyContent);
    } catch (err) {
      this.logger.error(`❌ Failed to create product variant in Storyblok for product id: ${productId}`, err);
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Creation failed");
    }
  }

  async deleteProductVariant({ product_id, product_variant_id }: DeleteSbProductVariantInput) {
    try {
      const productStory = await this.retrieveProductStory({ productId: product_id });

      if (!productStory) {
        this.logger.warn(`❌ No Storyblok story found for product id: ${product_id}`);
        return;
      }

      const variants = (productStory?.content?.variants || []).filter(
        (v) => v.medusaProductVariantId !== product_variant_id
      );

      const storyContent = {
        ...productStory,
        content: {
          ...productStory.content,
          variants,
        },
      };

      await this.update(productStory.id, storyContent);

      return storyContent;
    } catch (err) {
      this.logger.error(`❌ Failed to delete product variant in Storyblok for product id: ${product_id}`, err);
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Deletion failed");
    }
  }

  async forceSyncProductStory({ id, handle, title, thumbnail, images = [] }: CreateSbProductStoryInput) {
    try {
      const slug = handle;

      // Retrieve the existing product story
      const existingProductStory = await this.retrieveProductStory({
        productId: id,
        params: {
          version: "draft",
        },
      });

      if (!existingProductStory) {
        this.logger.error(`❌ No existing story found for force sync: ${slug} & id: ${id}`);
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "Story not found for force sync");
      }

      // Process images using the reusable method (smart deduplication included)
      const { gallery: productGallery } = await this.processProductImages({
        slug,
        thumbnail,
        images,
        title,
      });

      // Build updated story payload
      const story: UpdateSbProductStoryPayload = {
        ...existingProductStory,
        slug,
        content: {
          ...existingProductStory.content,
          component: "product",
          medusaProductId: id,
          title,
          gallery: productGallery,
        },
      };

      const updatedProductStory = await this.update(existingProductStory.id.toString(), story);

      this.logger.info(`✅ Force synced product story: ${slug}`);
      return updatedProductStory as unknown as ISbStoryData<ProductStory>;
    } catch (err) {
      this.logger.error(`❌ Failed to force sync story for ${title}`, err);
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Force sync failed");
    }
  }

  async forceSyncProductVariants({ productId, productVariants }: CreateSbProductVariantInput) {
    try {
      const productStory = await this.retrieveProductStory({ productId });

      if (!productStory) {
        this.logger.warn(`❌ No Storyblok story found for product id: ${productId}`);
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product story not found");
      }

      const slug = productStory.slug;

      // Build variant bloks with image galleries (replaces all existing variants)
      const productVariantBloks = await Promise.all(
        productVariants.map(async (productVariant) => {
          const variantTitle = productVariant?.title || "Unnamed Variant";

          // Process variant images using the reusable method
          const { gallery: variantGallery } = await this.processProductImages({
            slug,
            thumbnail: productVariant.thumbnail,
            images: productVariant.images,
            title: variantTitle,
          });

          return {
            title: variantTitle,
            component: "productVariant",
            medusaProductVariantId: productVariant.id,
            ...(variantGallery.length > 0 && { gallery: variantGallery }),
          };
        })
      );

      // Replace all variants (force sync behavior)
      const storyContent = {
        ...productStory,
        content: {
          ...productStory.content,
          variants: productVariantBloks,
        },
      };

      await this.update(productStory.id, storyContent);
      this.logger.info(`✅ Force synced ${productVariantBloks.length} variants for product: ${productId}`);
    } catch (err) {
      this.logger.error(`❌ Failed to force sync product variants for product id: ${productId}`, err);
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Force sync variants failed");
    }
  }

  getSbStoryEditorUrl({ id }: GetStoryblokStoryEditorUrlInput): string {
    const { spaceId } = this.options;
    return `https://app.storyblok.com/#/me/spaces/${spaceId}/stories/0/0/${id}`;
  }

  getOptions() {
    return this.options;
  }

  private async processProductImages({
    slug,
    thumbnail,
    images,
    title,
  }: {
    slug: string;
    thumbnail?: string;
    images?: Array<{ url: string }>;
    title: string;
  }): Promise<{ folderId?: string; gallery: GalleryImageBlok[] }> {
    let folderId: string | undefined;
    const gallery: GalleryImageBlok[] = [];

    if ((images && images.length > 0) || thumbnail) {
      this.logger.info(`Creating folder for: ${slug}`);
      folderId = await this.getOrCreateAssetFolder({ slug });

      // Upload thumbnail first if it exists
      if (thumbnail) {
        const uploadedThumbnail = await this.uploadImageToStoryblok({
          folderId: folderId!,
          imageUrl: thumbnail,
          altText: title,
        });

        gallery.push({
          component: "galleryImage",
          image: uploadedThumbnail,
          isThumbnail: true,
        });
      }

      // Upload all images from images array
      if (images && images.length > 0) {
        this.logger.info(`Uploading ${images.length} images for: ${title}`);

        const uploadedImages = await Promise.all(
          images.map((img) =>
            this.uploadImageToStoryblok({
              folderId: folderId!,
              imageUrl: img.url,
              altText: title,
            })
          )
        );

        uploadedImages.forEach((uploadedImg) => {
          gallery.push({
            component: "galleryImage",
            image: uploadedImg,
            isThumbnail: false,
          });
        });
      }
    }

    return { folderId, gallery };
  }

  mapImageUrl(src: string): string {
    if (!!this.options?.imageOptimization?.mapImageUrl) {
      return this.options.imageOptimization.mapImageUrl(src);
    }

    const { width, quality } = this.options?.imageOptimization || {};

    if (!src.includes("storyblok")) {
      return src;
    }

    // Parse the Storyblok URL
    const url = new URL(src);
    const path = url.pathname;

    const hasResize = path.includes("/m/");

    if (hasResize) {
      const resizedPath = path.replace(/\/m\/\d+x\d+/, `/m/${width}x0`);
      return `${url.origin}${resizedPath}`;
    }

    const optimizedQuality = quality || 80;

    return `${url.origin}${path}/m/${width}x0/filters:quality(${optimizedQuality}):format(webp)`;
  }

  removeEditable(data: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.removeEditable(item));
    }

    if (data !== null && typeof data === "object") {
      const cleaned: any = {};

      for (const key of Object.keys(data)) {
        if (key === "_editable") {
          continue;
        }
        cleaned[key] = this.removeEditable(data[key]);
      }

      return cleaned;
    }

    return data;
  }

  private async getAssetsByFolder(folderId: string): Promise<Map<string, ISbImageAsset>> {
    const { spaceId, personalAccessToken } = this.options;

    const response = await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}/assets?in_folder=${folderId}`, {
      method: "GET",
      headers: { Authorization: personalAccessToken },
    });

    const data = await response.json();
    const assetsMap = new Map<string, ISbImageAsset>();

    data.assets?.forEach((asset: ISbImageAsset) => {
      // Extract just the filename (not full path) and normalize to lowercase for comparison
      const filename = (asset.filename.split("/").pop() || "").toLowerCase();
      assetsMap.set(filename, asset);
    });

    return assetsMap;
  }

  private async getOrCreateAssetFolder({ slug }: GetOrCreateSbAssetFolderInput) {
    const { spaceId, personalAccessToken } = this.options;

    const foldersRes = await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}/asset_folders/`, {
      method: "GET",
      headers: { Authorization: personalAccessToken },
    });

    const folders = await foldersRes.json();
    const existing = folders.asset_folders?.find((f) => f.name.toLowerCase() === slug);

    if (existing) return existing.id as string;

    const createRes = await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}/asset_folders/`, {
      method: "POST",
      headers: {
        Authorization: personalAccessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asset_folder: {
          name: slug,
        },
      }),
    });
    const result = await createRes.json();

    return result.asset_folder?.id as string;
  }

  private async deleteAssetFolder({ slug }: GetOrCreateSbAssetFolderInput) {
    const { spaceId, personalAccessToken } = this.options;

    // First, find the folder
    const foldersRes = await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}/asset_folders/`, {
      method: "GET",
      headers: { Authorization: personalAccessToken },
    });

    const folders = await foldersRes.json();
    const folderToDelete = folders.asset_folders?.find((f: any) => f.name.toLowerCase() === slug);

    if (!folderToDelete) {
      this.logger.info(`Asset folder "${slug}" not found, skipping deletion`);
      return;
    }

    const folderId = folderToDelete.id;

    // Get all assets in the folder
    const assetsInFolder = await this.getAssetsByFolder(folderId);

    // Delete all assets in the folder
    if (assetsInFolder.size > 0) {
      this.logger.info(`Deleting ${assetsInFolder.size} assets from folder "${slug}"`);

      for (const [filename, asset] of assetsInFolder.entries()) {
        try {
          await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}/assets/${asset.id}`, {
            method: "DELETE",
            headers: { Authorization: personalAccessToken },
          });
          this.logger.info(`Deleted asset: ${filename}`);
        } catch (err) {
          this.logger.error(`Failed to delete asset ${filename}:`, err);
        }
      }
    }

    // Delete the folder itself
    await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}/asset_folders/${folderId}`, {
      method: "DELETE",
      headers: { Authorization: personalAccessToken },
    });

    this.logger.info(`Deleted folder "${slug}" with ID: ${folderId}`);
  }

  private async uploadImageToStoryblok({ folderId, imageUrl, altText }: UploadImageToSbInput): Promise<ISbImageAsset> {
    const { personalAccessToken, spaceId } = this.options;

    // Generate the sanitized filename and normalize to lowercase for comparison
    const rawName = imageUrl.split("/").pop() || "image.jpg";
    const filenameFromUrl = rawName
      .split("?")[0]
      .replace(/[^a-zA-Z0-9.]/g, "_")
      .toLowerCase();

    // Check if asset already exists in folder
    const existingAssets = await this.getAssetsByFolder(folderId);

    if (existingAssets.has(filenameFromUrl)) {
      this.logger.info(`Asset ${filenameFromUrl} already exists, reusing`);
      const existing = existingAssets.get(filenameFromUrl)!;

      // Return with our standard fields
      return {
        ...existing,
        fieldtype: "asset",
        meta_data: existing.meta_data || {},
        alt: altText || existing.alt || "",
        name: altText || existing.name || "",
        title: altText || existing.title || "",
      } as ISbImageAsset;
    }

    // Asset doesn't exist, proceed with upload
    this.logger.info(`Uploading new asset: ${filenameFromUrl}`);

    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Failed to fetch image: ${imageUrl}`);

    const arrayBuffer = await imageRes.arrayBuffer();
    const contentType = imageRes.headers.get("content-type") || "image/jpeg";
    const blob = new Blob([arrayBuffer], { type: contentType });

    const dimensions = sizeOf(Buffer.from(arrayBuffer));
    const size = `${dimensions.width}x${dimensions.height}`;

    // Step 2: Request signed upload
    const signedRes = await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}/assets`, {
      method: "POST",
      headers: {
        Authorization: personalAccessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: filenameFromUrl,
        size,
        asset_folder_id: folderId,
        validate_upload: 1,
      }),
    });

    const signedData = await signedRes.json();

    if (!signedRes.ok || !signedData || !signedData.post_url) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Failed to get signed upload data: ${JSON.stringify(signedData)}`
      );
    }

    // Step 3: Upload file to S3
    const form = new FormData();
    Object.entries(signedData.fields).forEach(([key, value]) => {
      //@ts-ignore
      form.append(key, value);
    });
    form.append("file", blob, filenameFromUrl);

    const s3Res = await fetch(signedData.post_url, {
      method: "POST",
      body: form,
    });

    if (!s3Res.ok) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `S3 upload failed: ${await s3Res.text()}`);
    }

    // Step 4: Finalize the upload
    const uploadImage = await fetch(
      `https://mapi.storyblok.com/v1/spaces/${spaceId}/assets/${signedData.id}/finish_upload`,
      {
        method: "GET",
        headers: {
          Authorization: personalAccessToken,
        },
      }
    );

    if (!uploadImage.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to finalize image upload: ${await uploadImage.text()}`
      );
    }

    const uploadedImage = await uploadImage.json();

    // Fix the filename URL - remove S3 prefix if present
    if (uploadedImage.filename && uploadedImage.filename.includes("s3.amazonaws.com/a.storyblok.com")) {
      uploadedImage.filename = uploadedImage.filename.replace(
        "https://s3.amazonaws.com/a.storyblok.com",
        "https://a.storyblok.com"
      );
    }

    // Ensure required fields are populated
    return {
      ...uploadedImage,
      fieldtype: "asset",
      meta_data: uploadedImage.meta_data || {},
      alt: altText || uploadedImage.alt || "",
      name: altText || uploadedImage.name || "",
      title: altText || uploadedImage.title || "",
    } as ISbImageAsset;
  }
}

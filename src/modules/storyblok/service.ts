import z from "zod";
import { Logger } from "@medusajs/medusa";
import StoryblokClient, { ISbStoryData } from "storyblok-js-client";
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

  async createProductStory({ id, handle, title }: CreateSbProductStoryInput) {
    try {
      const slug = handle;

      const story: CreateSbProductStoryPayload = {
        name: title,
        slug,
        parent_id: Number(this.options.productsParentFolderId),
        content: {
          component: "product",
          medusaProductId: id,
          title,
        },
      };

      const createdStory = await this.create(story);

      this.logger.info(`✅ Product story created: ${createdStory.story.slug}`);

      return createdStory as unknown as ISbStoryData<ProductStory>;
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

      const res = await this.delete(storyToDelete.id);

      this.logger.info(`🗑️  Deleted story: ${id}, slug: ${storyToDelete.slug}`);
      return res;
    } catch (err) {
      this.logger.error(`🔥 Failed to delete story: ${id}`, err);
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Delete failed");
    }
  }

  async listProductsStories({ fetchOptions, params }: ListSbProductsStoriesInput) {
    try {
      const res = await this.storyblokClient.getStories(
        {
          starts_with: `${this.options.productsParentFolderName}/`,
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

  async createProductVariant({ productId, productVariant }: CreateSbProductVariantInput) {
    try {
      const productStory = await this.retrieveProductStory({ productId });

      if (!productStory) {
        this.logger.warn(`❌ No Storyblok story found for product id: ${productId}`);
        return;
      }

      const productVariantBlok = {
        title: productVariant?.title || "Unnamed Variant",
        component: "productVariant",
        medusaProductVariantId: productVariant.id,
      };

      const variants = [...(productStory?.content?.variants || []), productVariantBlok];

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

  getSbStoryEditorUrl({ id }: GetStoryblokStoryEditorUrlInput): string {
    const { spaceId } = this.options;
    return `https://app.storyblok.com/#/me/spaces/${spaceId}/stories/0/0/${id}`;
  }

  getOptions() {
    return this.options;
  }

  mapImageUrl(src: string): string {
    if (!!this.options?.imageOptimization?.mapImageUrl) {
      return this.options.imageOptimization.mapImageUrl(src);
    }

    const { width, quality } = this.options?.imageOptimization || {};

    // If not a Storyblok image, return as-is
    if (!src.startsWith("https://a.storyblok.com")) {
      return src;
    }

    // Parse the Storyblok URL
    const url = new URL(src);
    const path = url.pathname;

    // Check if already has /m/ resize parameter
    const hasResize = path.includes("/m/");

    if (hasResize) {
      // Replace existing resize parameters
      const resizedPath = path.replace(/\/m\/\d+x\d+/, `/m/${width}x0`);
      return `${url.origin}${resizedPath}`;
    }

    // Add resize and optimization parameters
    // Format: {path}/{filename}/m/{width}x0/filters:quality(80):format(webp)
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
}

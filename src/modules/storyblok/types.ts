import { ProductVariantDTO, ProductDTO } from "@medusajs/types";
import { ISbConfig, ISbCustomFetch, ISbStoriesParams } from "storyblok-js-client";

export type AlphabiteStoryblokPluginOptions = {
  /**
   * Version of the stories to fetch from Storyblok API.
   */
  version?: "draft" | "published";

  /**
   * Personal access token for authenticating requests to Storyblok API.
   */
  accessToken: string;

  /**
   * Region of your Storyblok space (e.g. "us" or "eu").
   */
  region: ISbConfig["region"];

  /**
   * Webhook secret to validate incoming webhook requests from Storyblok.
   */
  webhookSecret?: string;

  /**
   * OAuth token used for authenticating requests to the Storyblok Management API.
   */
  personalAccessToken: string;

  /**
   * ID of your Storyblok space.
   */
  spaceId: string;

  /**
   * Folder ID in Storyblok where product stories are stored.
   */
  productsParentFolderId: string;

  /**
   * Folder name in Storyblok where product stories are stored.
   */
  productsParentFolderName: string;

  /**
   * If true, deletes the corresponding Medusa product
   * when its product story is deleted in Storyblok.
   * Defaults to false.
   */
  deleteProductOnSbProductStoryDelete?: boolean;

  /**
   * Image Optimization settings for Storyblok images.
   * width: The desired width of the image in px.
   * quality: The desired quality of the image (1-100).
   * mapImageUrl: A custom function to map and optimize image URLs. Overrides width and quality if provided.
   */
  imageOptimization?: {
    width: number;
    quality?: number;
    mapImageUrl?: (url: string) => string;
  };
};

export type ProductStory = {
  component: "product";
  medusaProductId: string;
  title: string;
  gallery?: GalleryBlok;
  variants: ProductVariantBlok[];
};

export type ProductVariantBlok = {
  component: "productVariant";
  medusaProductVariantId: string;
  title: string;
  gallery?: GalleryBlok;
};

export type GalleryImageBlok = {
  component: "galleryImage";
  image: ISbImageAsset;
  isThumbnail?: boolean;
};

export type GalleryBlok = GalleryImageBlok[];

export type CreateSbProductStoryInput = Pick<ProductDTO, "id" | "handle" | "title" | "thumbnail" | "images">;

export type CreateSbProductStoryPayload = {
  name: string;
  slug: string;
  parent_id: number;
  content: {
    component: "product";
    medusaProductId: string;
    title: string;
    gallery?: GalleryBlok;
    variants?: ProductVariantBlok[];
  };
};

export type UpdateSbProductStoryInput = {
  id: string;
  title: string;
  handle: string;
};

export type UpdateSbProductStoryPayload = {
  slug: string;
};

export type ListSbProductsStoriesInput = {
  products_ids?: string;
  fetchOptions?: ISbCustomFetch;
  params?: ISbStoriesParams;
};

export type RetrieveSbProductInput = {
  productId?: string;
  params?: ISbStoriesParams;
};

export type DeleteSbProductInput = {
  id: string;
};

export type CreateSbProductVariantInput = {
  productId: string;
  productVariants: Pick<ProductVariantDTO, "id" | "title" | "thumbnail" | "images">[];
};

export type DeleteSbProductVariantInput = { product_id: string; product_variant_id: string };

export interface GetStoryblokStoryEditorUrlInput {
  id: number | string;
}

export interface ISbImageAsset {
  alt: string;
  filename: string;
  copyright?: string;
  fieldtype?: string;
  focus?: string;
  id?: number;
  is_external_url?: boolean;
  name?: string;
  title?: string;
  meta_data?: {
    quality?: number;
    maxWidth?: number;
  };
}

export type UploadImageToSbInput = {
  imageUrl: string;
  folderId: string;
  altText?: string;
};

export type GetOrCreateSbAssetFolderInput = {
  slug: string;
};

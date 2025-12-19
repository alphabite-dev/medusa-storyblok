import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { FetchError } from "@medusajs/js-sdk";
import { QUERY_KEYS } from "../query-keys";
import { sdk } from "../../lib/sdk";

export type GetSbProductStoryRes = {
  storyblok_editor_url: string;
};

export interface UseGetProductSbStatusInput {
  product_id: string;
  options?: Omit<UseQueryOptions<Record<any, any>, FetchError, GetSbProductStoryRes, QueryKey>, "queryKey" | "queryFn">;
}

export const useRetrieveSbProduct = ({ product_id, options }: UseGetProductSbStatusInput) => {
  return useQuery({
    queryKey: QUERY_KEYS.SB_PRODUCT(product_id),
    queryFn: async (): Promise<GetSbProductStoryRes> => {
      const story = await sdk.client.fetch<GetSbProductStoryRes>(`/admin/storyblok/story/${product_id}`);

      return story;
    },
    enabled: !!product_id,
    ...options,
  });
};

export interface ListSbProductsRes {
  products: { id: string; name: string; handle: string; storyblok_editor_url: string | null }[];
  count: number;
  limit: number;
  offset: number;
}

export interface UseListSbProductsInput {
  offset?: number;
  limit?: number;
  options?: Omit<UseQueryOptions<Record<any, any>, FetchError, ListSbProductsRes, QueryKey>, "queryKey" | "queryFn">;
}

export const useListSbProducts = ({ offset = 0, limit = 20, options }: UseListSbProductsInput) => {
  return useQuery({
    queryKey: QUERY_KEYS.SB_PRODUCTS({ offset, limit }),
    queryFn: async (): Promise<ListSbProductsRes> => {
      const stories = await sdk.client.fetch<ListSbProductsRes>(`/admin/storyblok/story`, {
        query: { offset, limit },
      });

      return stories;
    },
    ...options,
  });
};

import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { FetchError } from "@medusajs/js-sdk";
import { QUERY_KEYS } from "../query-keys";
import { sdk } from "../../lib/sdk";

type GetSbProductStoryRes = {
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

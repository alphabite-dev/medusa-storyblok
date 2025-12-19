import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GetSbProductStoryRes, ListSbProductsRes } from "../query/use-retrieve-sb-product";
import { QUERY_KEYS } from "../query-keys";
import { toast } from "@medusajs/ui";

export const useCreateSbProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ product_id }: { product_id: string }) => {
      const response = await fetch(`/admin/storyblok/story/${product_id}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to create Storyblok product");
      }

      return (await response.json()) as GetSbProductStoryRes;
    },
    onSuccess: (data, input) => {
      queryClient.setQueryData<GetSbProductStoryRes>(QUERY_KEYS.SB_PRODUCT(input.product_id), (oldData) => {
        if (!oldData) {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SB_PRODUCT(input.product_id) });
          return oldData;
        }

        return { ...oldData, ...data };
      });

      queryClient.setQueriesData<ListSbProductsRes>(
        {
          predicate: (query) => {
            if (query.queryHash.includes("sb_products")) {
              return true;
            }

            return false;
          },
        },
        (oldData) => {
          if (!oldData) {
            queryClient.invalidateQueries({
              predicate(query) {
                if (query.queryHash.includes("sb_products")) {
                  return true;
                }

                return false;
              },
            });

            return;
          }

          const updatedProducts = oldData.products.map((product) => {
            if (product.id === input.product_id) {
              return { ...product, storyblok_editor_url: data.storyblok_editor_url };
            }
            return product;
          });

          return { ...oldData, products: updatedProducts };
        }
      );

      toast.success("Product successfully synced to Storyblok!", { duration: 3000 });
    },
    onError: (error) => {
      console.error("Error creating Storyblok product:", error);

      toast.error("Failed to sync product to Storyblok. Please try again.", { duration: 5000 });
    },
  });
};

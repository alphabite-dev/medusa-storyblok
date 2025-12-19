import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GetSbProductStoryRes } from "../query/use-retrieve-sb-product";
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

      toast.success("Product successfully synced to Storyblok!", { duration: 3000 });
    },
    onError: (error) => {
      console.error("Error creating Storyblok product:", error);

      toast.error("Failed to sync product to Storyblok. Please try again.", { duration: 5000 });
    },
  });
};

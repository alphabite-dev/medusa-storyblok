import { sdk } from "@medusajs/medusa/sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@medusajs/ui";
import { storyblokKeys } from "../query-keys";

type ForceSyncSbProductInput = {
  product_id: string;
};

export const useForceSyncSbProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ product_id }: ForceSyncSbProductInput) => {
      const res = await sdk.client.fetch(`/admin/storyblok/story/${product_id}`, {
        method: "PUT",
      });

      return await res.json();
    },
    onSuccess: () => {
      toast.success("Product force synced successfully");
      queryClient.invalidateQueries({ queryKey: storyblokKeys.all });
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to force sync product";
      toast.error(message);
    },
  });
};


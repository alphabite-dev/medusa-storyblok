import { sdk } from "@medusajs/medusa/sdk";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@medusajs/ui";

type BulkForceSyncSbProductsInput = {
  all?: boolean;
  product_ids?: string[];
};

export const useBulkForceSyncSbProducts = () => {
  return useMutation({
    mutationFn: async ({ all, product_ids }: BulkForceSyncSbProductsInput) => {
      const res = await sdk.client.fetch(`/admin/storyblok/bulk-force-sync`, {
        method: "POST",
        body: JSON.stringify({ all, product_ids }),
      });

      return await res.json();
    },
    onSuccess: () => {
      toast.success("Force sync initiated for selected products");
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to initiate force sync";
      toast.error(message);
    },
  });
};


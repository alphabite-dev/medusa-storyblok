import { useMutation } from "@tanstack/react-query";
import { GetSbProductStoryRes } from "../query/use-retrieve-sb-product";
import { toast } from "@medusajs/ui";

export const useBulkSyncSbProducts = () => {
  return useMutation({
    mutationFn: async ({ all, product_ids }: { all?: boolean; product_ids?: string[] }) => {
      const response = await fetch(`/admin/storyblok/bulk-sync`, {
        method: "POST",
        body: JSON.stringify({
          ...(all && { all }),
          ...(product_ids && { product_ids }),
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to create Storyblok product");
      }

      return (await response.json()) as GetSbProductStoryRes;
    },
    onSuccess: (data, input) => {
      toast.success(
        "Product synchronization started, it will continue on the background, refresh the page occasionally to see updates!",
        { duration: 10000 }
      );
    },
    onError: (error) => {
      console.error("Error creating Storyblok product:", error);

      toast.error("Failed to sync products to Storyblok. Please try again.", { duration: 5000 });
    },
  });
};

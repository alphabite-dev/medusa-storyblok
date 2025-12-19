import { createWorkflow, WorkflowResponse } from "@medusajs/workflows-sdk";
import { forceSyncSbProductVariantStep } from "./steps/force-sync-sb-product-variant-step";

type ForceSyncSbProductVariant = {
  product_id: string;
  variant_ids: string[];
};

export const forceSyncSbProductVariantWorkflowId = "force-sync-sb-product-variant-workflow";

export const forceSyncSbProductVariantsWorkflow = createWorkflow(
  {
    name: forceSyncSbProductVariantWorkflowId,
    retentionTime: 10000,
    store: true,
  },
  function ({ product_id, variant_ids }: ForceSyncSbProductVariant) {
    const result = forceSyncSbProductVariantStep({
      product_id,
      variant_ids,
    });

    return new WorkflowResponse(result);
  }
);


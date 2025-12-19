import { createWorkflow, WorkflowResponse } from "@medusajs/workflows-sdk";
import { forceSyncSbProductStep } from "./steps/force-sync-sb-product-step";

type ForceSyncSbProduct = {
  product_id: string;
};

export const forceSyncSbProductId = "force-sync-sb-product-workflow";

export const forceSyncSbProductWorkflow = createWorkflow(
  {
    name: forceSyncSbProductId,
    retentionTime: 10000,
    store: true,
  },
  function ({ product_id }: ForceSyncSbProduct) {
    const forcedSyncedProduct = forceSyncSbProductStep({
      product_id: product_id,
    });

    return new WorkflowResponse(forcedSyncedProduct);
  }
);


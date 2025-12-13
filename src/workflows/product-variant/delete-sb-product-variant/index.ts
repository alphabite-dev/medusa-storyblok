import { createWorkflow, WorkflowResponse } from "@medusajs/workflows-sdk";
import { deleteSbProductVariantStep } from "./steps/delete-sb-product-variant-step";

type DeleteSbProductVariantInput = {
  variant_id: string;
};

export const deleteSbProductVariantWorkflowId = "delete-sb-product-variant-workflow";
export const deleteSbProductVariantWorkflow = createWorkflow(
  {
    name: deleteSbProductVariantWorkflowId,
    retentionTime: 10000,
    store: true,
  },
  function ({ variant_id }: DeleteSbProductVariantInput) {
    const result = deleteSbProductVariantStep({ variant_id });

    return new WorkflowResponse(result);
  }
);

import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { createSbProductVariantStep } from "./steps/create-sb-product-variant-step";

type CreatSbProductVariantInput = {
  variant_id: string;
};

export const createSbProductVariantWorkflowId = "create-sb-product-variant-workflow";

export const createSbProductVariantWorkflow = createWorkflow(
  {
    name: createSbProductVariantWorkflowId,
    retentionTime: 10000,
    store: true,
  },
  function ({ variant_id }: CreatSbProductVariantInput) {
    const result = createSbProductVariantStep({ variant_id });

    return new WorkflowResponse(result);
  }
);

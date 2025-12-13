import { createWorkflow, WorkflowResponse } from "@medusajs/workflows-sdk";
import { updateSbProductStep } from "./steps/update-sb-product-step";

type UpdateSbProduct = {
  product_id: string;
};

export const updateSbProductWorkflowId = "update-sb-product-workflow";

export const updateSbProductWorkflow = createWorkflow(
  {
    name: updateSbProductWorkflowId,
    retentionTime: 10000,
    store: true,
  },
  function ({ product_id }: UpdateSbProduct) {
    const result = updateSbProductStep({ product_id });

    return new WorkflowResponse(result);
  }
);
